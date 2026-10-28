"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  APARTMENT_GLASS_COLOR, APARTMENT_SKIRTING_COLOR, APARTMENT_TOP_EDGE_COLOR,
  DEFAULT_TILE_SIZE,
  TWO_BED_WALL_COLOR, PARLOUR_WALL_COLOR, SELF_CON_WALL_COLOR,
  type ApartmentLayout, type ApartmentOpening, type ApartmentRoom, type ApartmentWall,
} from "@/lib/apartmentConfig";
import {
  FURNITURE_BY_ID, footprint, roomTiles, validateFurniturePlacement,
  type FurnitureItem, type FurnitureModelId, type PlacedFurniture,
} from "@/lib/furniture";
import CharacterModel, { type CharacterAction } from "@/components/game/CharacterModel";
import { CharacterAppearance, DEFAULT_CHARACTER_APPEARANCE } from "@/store/characterAppearance";
import type { GridNode, PathfindingGrid } from "@/lib/pathfinding";

const DAY_SKY = "#dfd6c9";
const NIGHT_SKY = "#1a1a2e";
const FLOOR_Y = 0.015;

/** Set to true to log how each sit / lie interaction was oriented (helps tuning). */
const DEBUG_INTERACTIONS = false;

/* ══════════════════════════════════════════════════════════════
   FURNITURE INTERACTION RULES
   Anything NOT listed here is "worked on": the character stands
   against it, faces it and puts his hands on it.

   mode "seat"  : character snaps onto the furniture (sit / lie)
   mode "enter" : character steps inside it (shower)
   height       : surface height of the furniture in world units
   facing       : manual extra rotation (radians). Use Math.PI for 180°,
                  Math.PI / 2 for 90°, if the auto-detected direction is off
   headEnd      : for lying. "high" = head at the taller end (headboard),
                  "low" = head at the lower end (bathtub, taps are at the feet)
   shift        : for seats. Slide forward (world units) so he doesn't sink into the backrest
   ══════════════════════════════════════════════════════════════ */
const SEAT_REFERENCE_HEIGHT = 0.45; // seat height that CharacterModel's SIT_DROP is tuned for
const STAND_OFF = 0.45;             // how far from the furniture edge he stands when working on it
const WORK_SECONDS = 3.5;
const SHOWER_SECONDS = 6;

type InteractionRule = {
  mode: "seat" | "enter";
  pose: "sit" | "lay" | "shower";
  height: number;
  facing: number;
  headEnd?: "high" | "low";
  shift?: number;
};

const INTERACTIONS: Partial<Record<FurnitureModelId, InteractionRule>> = {
  sofa: { mode: "seat", pose: "sit", height: 0.45, facing: 0, shift: 0.2 },
  chair: { mode: "seat", pose: "sit", height: 0.45, facing: 0, shift: 0.05 },
  dining: { mode: "seat", pose: "sit", height: 0.45, facing: 0 },
  toilet: { mode: "seat", pose: "sit", height: 0.4, facing: 0, shift: 0.2 },
  jacuzzi: { mode: "seat", pose: "sit", height: 0.3, facing: 0 },
  mattress: { mode: "seat", pose: "lay", height: 0.3, facing: Math.PI /2, headEnd: "high" },
  bed: { mode: "seat", pose: "lay", height: 0.4, facing: Math.PI /2, headEnd: "high" },
  bathtub: { mode: "seat", pose: "lay", height: 0.4, facing: 0, headEnd: "high" },
  "rain-shower": { mode: "enter", pose: "shower", height: 0, facing: 0 },
};

/** Model file used for each furniture model (for orientation detection). */
const MODEL_URLS: Partial<Record<FurnitureModelId, string>> = {
  mattress: "/models/mattress.glb",
  bed: "/models/bed.glb",
  sofa: "/models/sofa.glb",
  chair: "/models/chair.glb",
  dining: "/models/dining.glb",
  toilet: "/models/toilet.glb",
  bathtub: "/models/bathtub.glb",
  jacuzzi: "/models/jacuzzi.glb",
  "rain-shower": "/models/shower.glb",
};

/* ── Orientation detection ─────────────────────────────────────
   For every furniture GLB we record how tall each of its four sides is
   (outer 20% strip). Backrests / headboards / toilet tanks stand out. */
type ModelProfile = { H: number; px: number; nx: number; pz: number; nz: number };
const MODEL_PROFILES = new Map<string, ModelProfile>();

function computeProfile(root: THREE.Object3D, box: THREE.Box3): ModelProfile | null {
  const size = new THREE.Vector3();
  box.getSize(size);
  if (size.y <= 0.001) return null;
  const stripX = size.x * 0.2;
  const stripZ = size.z * 0.2;
  const profile: ModelProfile = { H: size.y, px: 0, nx: 0, pz: 0, nz: 0 };
  const v = new THREE.Vector3();
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const pos = mesh.geometry.getAttribute("position");
    if (!pos) return;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      const y = v.y - box.min.y;
      if (v.x > box.max.x - stripX) profile.px = Math.max(profile.px, y);
      if (v.x < box.min.x + stripX) profile.nx = Math.max(profile.nx, y);
      if (v.z > box.max.z - stripZ) profile.pz = Math.max(profile.pz, y);
      if (v.z < box.min.z + stripZ) profile.nz = Math.max(profile.nz, y);
    }
  });
  return profile;
}

/** Direction (in furniture space) a seated person should face, or null when unclear. */
function frontOf(p: ModelProfile): [number, number] | null {
  const sides: { score: number; v: [number, number] }[] = [
    { score: p.px - p.nx, v: [1, 0] },
    { score: p.nx - p.px, v: [-1, 0] },
    { score: p.pz - p.nz, v: [0, 1] },
    { score: p.nz - p.pz, v: [0, -1] },
  ];
  const best = sides.reduce((a, b) => (b.score > a.score ? b : a));
  if (best.score < p.H * 0.08) return null;
  return [-best.v[0], -best.v[1]]; // front = opposite of the backrest
}

/** Direction (in furniture space) the head should point when lying, or null when unclear. */
function headOf(p: ModelProfile, axis: "x" | "z", headEnd: "high" | "low"): [number, number] | null {
  const plusHeight = axis === "x" ? p.px : p.pz;
  const minusHeight = axis === "x" ? p.nx : p.nz;
  const diff = plusHeight - minusHeight;
  if (Math.abs(diff) < p.H * 0.05) return null;
  const highIsPlus = diff > 0;
  const headIsPlus = headEnd === "high" ? highIsPlus : !highIsPlus;
  const s = headIsPlus ? 1 : -1;
  return axis === "x" ? [s, 0] : [0, s];
}

export type Interaction = {
  uid: string;
  mode: "seat" | "enter" | "near";
  pose: CharacterAction;
  x: number;
  z: number;
  rotationY: number;
  yAdjust: number;
  halfW: number;
  halfD: number;
  faceApproach: boolean;
};

/** Sent from HomeInterior: "walk to this furniture and use it". Change `token` for every new request. */
export type InteractionRequest = { token: number; uid: string };

type PlayerCommand = { id: number; x: number; z: number; interact?: Interaction };

function getWallColor(layoutId: string): string {
  if (layoutId === "two-bedroom") return TWO_BED_WALL_COLOR;
  if (layoutId === "room-parlour") return PARLOUR_WALL_COLOR;
  return SELF_CON_WALL_COLOR;
}

function useCheckerTexture(room: ApartmentRoom) {
  const texture = useMemo(() => {
    if (room.floorDark === undefined || typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 128; canvas.height = 128;
    const context = canvas.getContext("2d");
    if (!context) return null;
    const squareSize = canvas.width / 2;
    for (let row = 0; row < 2; row += 1) {
      for (let column = 0; column < 2; column += 1) {
        context.fillStyle = (row + column) % 2 === 0 ? room.floorLight : room.floorDark;
        context.fillRect(column * squareSize, row * squareSize, squareSize, squareSize);
      }
    }
    const nextTexture = new THREE.CanvasTexture(canvas);
    const tileSize = room.tileSize ?? DEFAULT_TILE_SIZE;
    nextTexture.wrapS = THREE.RepeatWrapping;
    nextTexture.wrapT = THREE.RepeatWrapping;
    nextTexture.repeat.set((room.width / tileSize) / 2, (room.depth / tileSize) / 2);
    nextTexture.colorSpace = THREE.SRGBColorSpace;
    nextTexture.anisotropy = 4;
    return nextTexture;
  }, [room]);
  useEffect(() => () => texture?.dispose(), [texture]);
  return texture;
}

function RoomFloor({ room, onFloorClick }: { room: ApartmentRoom; onFloorClick: (x: number, z: number) => void }) {
  const texture = useCheckerTexture(room);
  return (
    <mesh
      position={[room.x + room.width / 2, FLOOR_Y, room.z + room.depth / 2]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
      onPointerDown={(e) => {
        e.stopPropagation();
        onFloorClick(e.point.x, e.point.z);
      }}
    >
      <planeGeometry args={[room.width, room.depth]} />
      {texture ? <meshStandardMaterial map={texture} roughness={0.92} /> : <meshStandardMaterial color={room.floorLight} roughness={0.92} />}
    </mesh>
  );
}

function WallWithHole({ width, height, thickness, openings, color }: {
  width: number; height: number; thickness: number;
  openings: ApartmentOpening[];
  color: string;
}) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-width / 2, 0);
    s.lineTo(width / 2, 0);
    s.lineTo(width / 2, height);
    s.lineTo(-width / 2, height);
    s.lineTo(-width / 2, 0);

    for (const op of openings) {
      if (op.type === "door" || op.type === "window") {
        const opX = op.position - width / 2;
        const opY = op.type === "door" ? 0 : (op.sillHeight ?? 0);

        const hole = new THREE.Path();
        hole.moveTo(opX - op.width / 2, opY);
        hole.lineTo(opX + op.width / 2, opY);
        hole.lineTo(opX + op.width / 2, opY + op.height);
        hole.lineTo(opX - op.width / 2, opY + op.height);
        hole.lineTo(opX - op.width / 2, opY);
        s.holes.push(hole);
      }
    }
    return s;
  }, [width, height, openings]);

  const geometry = useMemo(() => new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false }), [shape, thickness]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} position={[0, 0, -thickness / 2]} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  );
}

function WallLight({ layoutId, isNight, position, rotation }: {
  layoutId: string; isNight: boolean; position: [number, number, number]; rotation: [number, number, number];
}) {
  if (!isNight) return null;

  let lightColor = "#ffd59a";
  let intensity = 10;
  let distance = 40;
  let baseColor = "#222222";

  if (layoutId === "two-bedroom") {
    lightColor = "#ffffff";
    intensity = 15;
    distance = 90;
    baseColor = "#d4af37";
  } else if (layoutId === "room-parlour") {
    lightColor = "#fff0db";
    intensity = 10;
    distance = 40;
    baseColor = "#a0a0a0";
  }

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0, 0.05]} castShadow>
        <boxGeometry args={[0.15, 0.3, 0.1]} />
        <meshStandardMaterial color={baseColor} metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0, 0.15]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color={lightColor} emissive={lightColor} emissiveIntensity={3} toneMapped={false} />
      </mesh>
      <pointLight color={lightColor} intensity={intensity} distance={distance} decay={2} position={[0, 0, 0.3]} castShadow shadow-mapSize={[512, 512]} />
    </group>
  );
}

function WindowModel({ url, targetWidth, targetDepth, targetHeight }: { url: string; targetWidth: number; targetDepth: number; targetHeight: number; }) {
  const { scene } = useGLTF(url);
  const { clonedScene, scale, offset } = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((m) => {
            m.side = THREE.DoubleSide;
            if (m.name.toLowerCase().includes("glass") || m.transparent) {
              m.transparent = true;
              m.opacity = 0.4;
              m.depthWrite = false;
              m.color.set("#a4d1d8");
            }
          });
        }
      }
    });
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);

    const scaleX = size.x > 0 ? targetWidth / size.x : 1;
    const scaleY = size.y > 0 ? targetHeight / size.y : 1;
    const scaleZ = size.z > 0 ? targetDepth / size.z : 1;

    const center = new THREE.Vector3();
    box.getCenter(center);

    const offset: [number, number, number] = [
      -center.x * scaleX,
      -center.y * scaleY,
      -center.z * scaleZ,
    ];

    return { clonedScene: clone, scale: [scaleX, scaleY, scaleZ] as [number, number, number], offset };
  }, [scene, targetWidth, targetDepth, targetHeight]);

  return (
    <group scale={scale} position={offset}>
      <primitive object={clonedScene} />
    </group>
  );
}

function ApartmentWallView({ wall, openings: allOpenings, wallColor, onExitToMap }: {
  wall: ApartmentWall; openings: ApartmentOpening[]; wallColor: string; onExitToMap?: () => void;
}) {
  const dx = wall.end[0] - wall.start[0];
  const dz = wall.end[1] - wall.start[1];
  const length = Math.hypot(dx, dz);
  const rotation = -Math.atan2(dz, dx);
  const openings = allOpenings.filter((o) => o.wallId === wall.id);
  const style = wall.style ?? "wall";
  if (style === "railing") return null;

  const door = openings.find((o) => o.type === "door");
  const doorX = door ? door.position - length / 2 : 0;
  const doorWidth = door ? door.width : 0;

  const SKIRT_H = 0.14;
  const SKIRT_T = 0.04;
  const SKIRT_Y = SKIRT_H / 2;
  const SKIRT_Z = wall.thickness / 2 + 0.05;

  const skirtSegments: { x: number; w: number }[] = [];
  if (door) {
    if (doorX > -length / 2 + 0.1) {
      skirtSegments.push({ x: (-length / 2 + (doorX - doorWidth / 2)) / 2, w: (doorX - doorWidth / 2) + length / 2 });
    }
    if (doorX < length / 2 - 0.1) {
      skirtSegments.push({ x: ((doorX + doorWidth / 2) + length / 2) / 2, w: length / 2 - (doorX + doorWidth / 2) });
    }
  } else {
    skirtSegments.push({ x: 0, w: length });
  }

  return (
    // Walls swallow taps so the floor / furniture behind them is never clicked
    <group
      position={[(wall.start[0] + wall.end[0]) / 2, 0, (wall.start[1] + wall.end[1]) / 2]}
      rotation={[0, rotation, 0]}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >

      <WallWithHole width={length} height={wall.height} thickness={wall.thickness} openings={openings} color={wallColor} />

      {skirtSegments.map((seg, i) => (
        <mesh key={`skirt-${i}`} position={[seg.x, SKIRT_Y, SKIRT_Z]} castShadow={false} receiveShadow={false}>
          <boxGeometry args={[seg.w, SKIRT_H, SKIRT_T]} />
          <meshStandardMaterial color={APARTMENT_SKIRTING_COLOR} roughness={0.82} />
        </mesh>
      ))}

      <mesh position={[0, wall.height - 0.025, wall.thickness / 2 + 0.015]}>
        <boxGeometry args={[length, 0.05, wall.thickness + 0.035]} />
        <meshStandardMaterial color={APARTMENT_TOP_EDGE_COLOR} roughness={0.82} />
      </mesh>

      {door && (
        <group
          position={[doorX, 0, wall.thickness / 2 + 0.035]}
          onClick={(e) => { e.stopPropagation(); onExitToMap?.(); }}
          onPointerOver={() => (document.body.style.cursor = 'pointer')}
          onPointerOut={() => (document.body.style.cursor = 'auto')}
        >
          <mesh position={[0, door.height / 2, 0]} castShadow>
            <boxGeometry args={[door.width - 0.1, door.height - 0.05, 0.07]} />
            <meshStandardMaterial color="#5a3b28" roughness={0.85} />
          </mesh>
          <mesh position={[door.width * 0.35, door.height / 2, 0.045]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial color="#d0aa67" metalness={0.5} />
          </mesh>
        </group>
      )}

      {openings.filter(o => o.type === "window").map((opening) => (
        <group
          key={`window-${opening.position}`}
          position={[
            opening.position - length / 2,
            (opening.sillHeight ?? 0) + (opening.height / 2),
            0
          ]}
        >
          <Suspense fallback={null}>
            <WindowModel
              url="/models/window.glb"
              targetWidth={opening.width}
              targetDepth={wall.thickness}
              targetHeight={opening.height}
            />
          </Suspense>
        </group>
      ))}
    </group>
  );
}

function WoodenStaircase() {
  return (
    <group position={[-7, 0, 4]}>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} position={[0, i * 0.25 + 0.125, i * 0.35]} castShadow receiveShadow>
          <boxGeometry args={[1.5, 0.25, 0.35]} />
          <meshStandardMaterial color="#5a3b28" roughness={0.85} />
        </mesh>
      ))}
      {[-0.75, 0.75].map((x) => (
        <mesh key={x} position={[x, 1.0, 1.4]} rotation={[0.5, 0, 0]} castShadow>
          <boxGeometry args={[0.06, 0.06, 3.5]} />
          <meshStandardMaterial color="#3a2a1f" roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

function GLTFModel({ url, targetWidth, targetDepth, targetHeight }: { url: string; targetWidth: number; targetDepth: number; targetHeight: number; }) {
  const { scene } = useGLTF(url);
  const { clonedScene, scale, offset, profile } = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);

    const scaleX = size.x > 0 ? targetWidth / size.x : 1;
    const scaleY = size.y > 0 ? targetHeight / size.y : 1;
    const scaleZ = size.z > 0 ? targetDepth / size.z : 1;

    const center = new THREE.Vector3();
    box.getCenter(center);

    const offset: [number, number, number] = [
      -center.x * scaleX,
      -box.min.y * scaleY,
      -center.z * scaleZ,
    ];

    const profile = computeProfile(clone, box);

    return { clonedScene: clone, scale: [scaleX, scaleY, scaleZ] as [number, number, number], offset, profile };
  }, [scene, targetWidth, targetDepth, targetHeight]);

  // Remember how this model is oriented so the character can sit / lie the right way
  useEffect(() => {
    if (profile) MODEL_PROFILES.set(url, profile);
  }, [url, profile]);

  return (
    <group scale={scale} position={offset}>
      <primitive object={clonedScene} />
    </group>
  );
}

function B({ p, s, c, rough = 0.8 }: { p: [number, number, number]; s: [number, number, number]; c: string; rough?: number; }) {
  return <mesh position={p} castShadow receiveShadow><boxGeometry args={s} /><meshStandardMaterial color={c} roughness={rough} /></mesh>;
}

function FurnitureModel({ item, W, D }: { item: FurnitureItem; W: number; D: number; }) {
  if (item.id === "bath-wc-toilet") return (<Suspense fallback={<B p={[0, 0.3, 0]} s={[W, 0.6, D]} c="#f2f2f2" />}><GLTFModel url="/models/toilet.glb" targetWidth={W} targetDepth={D} targetHeight={0.8} /></Suspense>);
  if (item.id === "bath-bathtub") return (<Suspense fallback={<B p={[0, 0.3, 0]} s={[W, 0.6, D]} c="#f7f7f7" />}><GLTFModel url="/models/bathtub.glb" targetWidth={W} targetDepth={D} targetHeight={0.6} /></Suspense>);
  if (item.id === "bath-jacuzzi") return (<Suspense fallback={<B p={[0, 0.3, 0]} s={[W, 0.6, D]} c="#c8b48d" />}><GLTFModel url="/models/jacuzzi.glb" targetWidth={W} targetDepth={D} targetHeight={0.8} /></Suspense>);
  if (item.id === "bath-rain-shower") return (<Suspense fallback={<B p={[0, 1, 0]} s={[W, 2, D]} c="#c0c6ca" />}><GLTFModel url="/models/shower.glb" targetWidth={W} targetDepth={D} targetHeight={2.0} /></Suspense>);

  const gltfMap: Record<string, { url: string, height: number }> = {
    "mattress": { url: "/models/mattress.glb", height: 0.3 },
    "bed": { url: "/models/bed.glb", height: 0.8 },
    "wardrobe": { url: "/models/wardrobe.glb", height: 1.9 },
    "sofa": { url: "/models/sofa.glb", height: 0.8 },
    "chair": { url: "/models/chair.glb", height: 0.8 },
    "table": { url: "/models/table.glb", height: 0.5 },
    "tv": { url: "/models/tv.glb", height: 1.0 },
    "dining": { url: "/models/dining.glb", height: 0.8 },
    "fridge": { url: "/models/fridge.glb", height: 1.7 },
    "cooker": { url: "/models/cooker.glb", height: 0.9 },
    "washer": { url: "/models/washer.glb", height: 0.9 },
    "solar": { url: "/models/solar.glb", height: 0.7 },
    "fan": { url: "/models/fan.glb", height: 1.2 },
    "plant": { url: "/models/plant.glb", height: 0.8 },
    "dispenser": { url: "/models/dispenser.glb", height: 1.2 },
    "rug": { url: "/models/rug.glb", height: 0.05 },
    "bucket": { url: "/models/bucket.glb", height: 0.3 },
    "water-drum": { url: "/models/water-drum.glb", height: 0.5 },
    "toilet": { url: "/models/toilet.glb", height: 0.8 },
    "rain-shower": { url: "/models/shower.glb", height: 2.0 },
    "baby-bath": { url: "/models/baby-bath.glb", height: 0.3 },
    "bathtub": { url: "/models/bathtub.glb", height: 0.6 },
    "jacuzzi": { url: "/models/jacuzzi.glb", height: 0.8 },
  };

  const gltf = gltfMap[item.model];
  if (gltf) {
    return (
      <Suspense fallback={<B p={[0, 0.3, 0]} s={[W, 0.6, D]} c="#999999" />}>
        <GLTFModel url={gltf.url} targetWidth={W} targetDepth={D} targetHeight={gltf.height} />
      </Suspense>
    );
  }

  switch (item.model) {
    case "mattress": return (<><B p={[0, 0.12, 0]} s={[W, 0.24, D]} c="#e8d9b8" /><B p={[0, 0.26, -D * 0.38]} s={[W * 0.7, 0.1, 0.3]} c="#ffffff" /><B p={[0, 0.25, D * 0.12]} s={[W * 0.96, 0.06, D * 0.7]} c="#5f8fb0" /></>);
    case "bed": return (<><B p={[0, 0.16, 0]} s={[W, 0.32, D]} c="#6d4a33" /><B p={[0, 0.42, 0.04]} s={[W * 0.94, 0.22, D * 0.94]} c="#f2ece0" /><B p={[0, 0.75, -D / 2 + 0.05]} s={[W, 0.9, 0.1]} c="#5a3b28" /><B p={[0, 0.56, D * 0.16]} s={[W * 0.96, 0.08, D * 0.6]} c="#c0504a" /></>);
    case "wardrobe": return (<><B p={[0, 0.95, 0]} s={[W, 1.9, D]} c="#7a5236" /></>);
    case "sofa": return (<><B p={[0, 0.2, 0]} s={[W, 0.4, D]} c="#8b5a3c" /><B p={[0, 0.5, D * 0.08]} s={[W * 0.86, 0.22, D * 0.62]} c="#b37a55" /><B p={[0, 0.62, -D / 2 + 0.12]} s={[W, 0.7, 0.24]} c="#7b4d32" /></>);
    case "table": return (<><B p={[0, 0.38, 0]} s={[W, 0.06, D]} c="#8d6444" /></>);
    case "tv": return (<><B p={[0, 0.25, 0]} s={[W, 0.5, D * 0.9]} c="#5a3b28" /><B p={[0, 0.95, 0]} s={[W * 0.8, 0.8, 0.07]} c="#15181a" /></>);
    case "dining": return (<><B p={[0, 0.7, 0]} s={[W * 0.6, 0.06, D * 0.6]} c="#8d6444" /></>);
    case "fridge": return (<><B p={[0, 0.85, 0]} s={[W * 0.9, 1.7, D * 0.9]} c="#e9edee" /></>);
    case "cooker": return (<><B p={[0, 0.42, 0]} s={[W * 0.92, 0.84, D * 0.92]} c="#d7dadb" /></>);
    case "washer": return (<><B p={[0, 0.45, 0]} s={[W * 0.92, 0.9, D * 0.92]} c="#f1f3f4" /></>);
    case "solar": return (<><B p={[0, 0.35, 0]} s={[W * 0.9, 0.5, D * 0.9]} c="#d9402f" /></>);
    case "fan": return (<><B p={[0, 0.03, 0]} s={[0.4, 0.06, 0.4]} c="#d9dde0" /><B p={[0, 0.55, 0]} s={[0.05, 1.1, 0.05]} c="#bfc6ca" /></>);
    case "rug": return (<><B p={[0, 0.015, 0]} s={[W, 0.03, D]} c="#b4513f" rough={1} /></>);
    case "dispenser": return (<><B p={[0, 0.5, 0]} s={[W * 0.7, 1, D * 0.7]} c="#dfe7ea" /></>);
    case "plant": return (<><B p={[0, 0.17, 0]} s={[0.34, 0.34, 0.34]} c="#b4673c" /><mesh position={[0, 0.58, 0]} castShadow><icosahedronGeometry args={[0.28, 1]} /><meshStandardMaterial color="#3f8f4f" roughness={0.9} /></mesh></>);
    case "bucket": return (<><B p={[-0.12, 0.15, 0]} s={[0.24, 0.3, 0.24]} c="#2f6fb4" /><B p={[0.12, 0.06, 0]} s={[0.28, 0.12, 0.28]} c="#d9dde0" /></>);
    case "water-drum": return (<><B p={[-0.1, 0.25, 0]} s={[0.3, 0.5, 0.3]} c="#2e7d5a" /><B p={[0.15, 0.18, 0.05]} s={[0.16, 0.36, 0.16]} c="#e5b95b" /></>);
    case "toilet": return (<><B p={[0, 0.15, 0]} s={[0.28, 0.3, 0.4]} c="#f2f2f2" /><B p={[0, 0.42, -0.15]} s={[0.28, 0.24, 0.1]} c="#e9edee" /></>);
    case "rain-shower": return (<><B p={[0, 1, 0]} s={[0.05, 2, 0.05]} c="#c0c6ca" /><B p={[0, 2, 0]} s={[0.5, 0.04, 0.5]} c="#d6dde1" /></>);
    case "baby-bath": return (<B p={[0, 0.15, 0]} s={[0.6, 0.3, 0.35]} c="#a4d1d8" />);
    case "bathtub": return (<B p={[0, 0.3, 0]} s={[W, 0.6, D]} c="#f7f7f7" />);
    case "jacuzzi": return (<B p={[0, 0.25, 0]} s={[W, 0.5, D]} c="#c8b48d" />);
    default: return (<B p={[0, 0.3, 0]} s={[W, 0.6, D]} c="#999999" />);
  }
}

function FurnitureHighlight({ x, z, w, d, valid }: { x: number, z: number, w: number, d: number, valid: boolean }) {
  return (
    <mesh position={[x, FLOOR_Y + 0.01, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[w - 0.05, d - 0.05]} />
      <meshBasicMaterial color={valid ? "#34d399" : "#ef4444"} transparent opacity={0.6} depthWrite={false} />
    </mesh>
  );
}

function FurnitureLayer({ layout, furniture, onSelectFurniture, movingUid, isValid }: {
  layout: ApartmentLayout;
  furniture: PlacedFurniture[];
  onSelectFurniture: (uid: string) => void;
  movingUid: string | null;
  isValid: boolean;
}) {
  return (
    <group>
      {furniture.map((entry) => {
        const item = FURNITURE_BY_ID[entry.itemId];
        const room = layout.rooms.find((r) => r.id === entry.roomId);
        if (!item || !room) return null;
        const tile = room.tileSize ?? DEFAULT_TILE_SIZE;
        const { cols, rows } = roomTiles(room);
        const size = footprint(item, entry.rotation);
        const x = room.x + entry.col * (room.width / cols) + (size.w * tile) / 2;
        const z = room.z + entry.row * (room.depth / rows) + (size.d * tile) / 2;

        return (
          <group key={entry.uid}>
            {movingUid === entry.uid && (
              <FurnitureHighlight x={x} z={z} w={size.w * tile} d={size.d * tile} valid={isValid} />
            )}
            <group
              position={[x, FLOOR_Y, z]}
              rotation={[0, entry.rotation * Math.PI / 2, 0]}
              onClick={(event) => { event.stopPropagation(); onSelectFurniture(entry.uid); }}
            >
              <FurnitureModel item={item} W={item.w * tile} D={item.d * tile} />
            </group>
          </group>
        );
      })}
    </group>
  );
}

/** Where is this furniture, and how should the character use it? */
function buildInteraction(layout: ApartmentLayout, entry: PlacedFurniture): Interaction | null {
  const item = FURNITURE_BY_ID[entry.itemId];
  const room = layout.rooms.find((r) => r.id === entry.roomId);
  if (!item || !room) return null;

  const tile = room.tileSize ?? DEFAULT_TILE_SIZE;
  const { cols, rows } = roomTiles(room);
  const size = footprint(item, entry.rotation);
  const halfW = (size.w * tile) / 2;
  const halfD = (size.d * tile) / 2;
  let x = room.x + entry.col * (room.width / cols) + halfW;
  let z = room.z + entry.row * (room.depth / rows) + halfD;
  const furnitureRot = (entry.rotation * Math.PI) / 2;

  const rule = INTERACTIONS[item.model];
  if (!rule) {
    // Not sit / lie / enter: stand against it and work on it
    return { uid: entry.uid, mode: "near", pose: "work", x, z, rotationY: furnitureRot, yAdjust: 0, halfW, halfD, faceApproach: false };
  }

  const url = MODEL_URLS[item.model];
  const profile = url ? MODEL_PROFILES.get(url) : undefined;

  let localAngle = 0; // rotation relative to the furniture's own rotation
  let front: [number, number] = [0, 1];

  if (rule.pose === "lay") {
    // Lie along the furniture's long side, head toward the headboard end
    const longAxis: "x" | "z" = item.w > item.d ? "x" : "z";
    const detected = profile ? headOf(profile, longAxis, rule.headEnd ?? "high") : null;
    const head: [number, number] = detected ?? (longAxis === "x" ? [-1, 0] : [0, -1]);
    localAngle = Math.atan2(-head[0], -head[1]);
    if (DEBUG_INTERACTIONS) console.log("[lay]", item.model, { longAxis, detected, head, profile });
  } else if (rule.pose === "sit") {
    // Face away from the backrest
    const detected = profile ? frontOf(profile) : null;
    front = detected ?? [0, 1];
    localAngle = Math.atan2(front[0], front[1]);
    if (DEBUG_INTERACTIONS) console.log("[sit]", item.model, { detected, front, profile });

    if (rule.shift) {
      const forward = new THREE.Vector3(front[0], 0, front[1]).applyAxisAngle(new THREE.Vector3(0, 1, 0), furnitureRot);
      x += forward.x * rule.shift;
      z += forward.z * rule.shift;
    }
  }

  const yAdjust =
    rule.pose === "sit" ? rule.height - SEAT_REFERENCE_HEIGHT : rule.pose === "lay" ? rule.height : 0;

  return {
    uid: entry.uid,
    mode: rule.mode,
    pose: rule.pose,
    x,
    z,
    rotationY: furnitureRot + localAngle + rule.facing,
    yAdjust,
    halfW,
    halfD,
    faceApproach: rule.mode === "enter",
  };
}

/* ══════════════════════════════════════════════════════════════
   WALKING: tiles + walls
   - a tile is walkable only if its centre is inside a room
   - a step between two tiles is blocked when it crosses a wall
     (door gaps are the only way through)
   - furniture blocks its own tiles
   ══════════════════════════════════════════════════════════════ */
type WallPiece = {
  sx: number; sz: number; // wall start
  ux: number; uz: number; // direction along the wall
  vx: number; vz: number; // perpendicular
  a: number; b: number;   // solid stretch along the wall
  h: number;              // half thickness
};

type WalkBase = {
  minX: number; minZ: number; cols: number; rows: number; tileSize: number;
  inside: boolean[][];
  edges: Uint8Array;
  pieces: WallPiece[];
};

type PathData = {
  grid: PathfindingGrid;
  originX: number;
  originZ: number;
  tileSize: number;
  edges: Uint8Array;
  pieces: WallPiece[];
};

// 0..3 orthogonal (up, right, down, left), 4..7 diagonal
const DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, -1], [1, 0], [0, 1], [-1, 0],
  [1, -1], [1, 1], [-1, 1], [-1, -1],
];

function segHitsRect(u0: number, v0: number, u1: number, v1: number, a: number, b: number, h: number): boolean {
  let t0 = 0;
  let t1 = 1;
  const du = u1 - u0;
  const dv = v1 - v0;
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  return clip(-du, u0 - a) && clip(du, b - u0) && clip(-dv, v0 + h) && clip(dv, h - v0);
}

function segmentHitsPiece(pc: WallPiece, x0: number, z0: number, x1: number, z1: number): boolean {
  const u0 = (x0 - pc.sx) * pc.ux + (z0 - pc.sz) * pc.uz;
  const v0 = (x0 - pc.sx) * pc.vx + (z0 - pc.sz) * pc.vz;
  const u1 = (x1 - pc.sx) * pc.ux + (z1 - pc.sz) * pc.uz;
  const v1 = (x1 - pc.sx) * pc.vx + (z1 - pc.sz) * pc.vz;
  return segHitsRect(u0, v0, u1, v1, pc.a, pc.b, pc.h);
}

function segmentBlocked(pd: PathData, x0: number, z0: number, x1: number, z1: number): boolean {
  return pd.pieces.some((pc) => segmentHitsPiece(pc, x0, z0, x1, z1));
}

function buildWallPieces(layout: ApartmentLayout, tileSize: number): WallPiece[] {
  const pieces: WallPiece[] = [];
  for (const wall of layout.walls) {
    const dx = wall.end[0] - wall.start[0];
    const dz = wall.end[1] - wall.start[1];
    const length = Math.hypot(dx, dz);
    if (length < 0.001) continue;
    const ux = dx / length;
    const uz = dz / length;
    const vx = -uz;
    const vz = ux;
    const h = Math.max(0.02, wall.thickness / 2 - 0.01);

    // Door gaps are the only openings that let you through (min. one tile wide)
    const gaps = layout.openings
      .filter((o) => o.wallId === wall.id && o.type === "door")
      .map((o) => {
        const g = Math.max(o.width, tileSize);
        return [o.position - g / 2, o.position + g / 2] as const;
      })
      .sort((p, q) => p[0] - q[0]);

    const base = { sx: wall.start[0], sz: wall.start[1], ux, uz, vx, vz, h };
    let cursor = 0;
    for (const gap of gaps) {
      if (gap[0] > cursor) pieces.push({ ...base, a: cursor, b: Math.min(gap[0], length) });
      cursor = Math.max(cursor, gap[1]);
    }
    if (cursor < length) pieces.push({ ...base, a: cursor, b: length });
  }
  return pieces;
}

function buildWalkBase(layout: ApartmentLayout): WalkBase {
  const tileSize = DEFAULT_TILE_SIZE;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const room of layout.rooms) {
    minX = Math.min(minX, room.x);
    maxX = Math.max(maxX, room.x + room.width);
    minZ = Math.min(minZ, room.z);
    maxZ = Math.max(maxZ, room.z + room.depth);
  }
  if (!isFinite(minX)) { minX = -20; maxX = 20; minZ = -20; maxZ = 20; }

  const cols = Math.ceil((maxX - minX) / tileSize);
  const rows = Math.ceil((maxZ - minZ) / tileSize);
  const eps = 1e-6;

  // Only tiles whose centre lies inside a room can be walked on
  const inside: boolean[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      const cx = minX + c * tileSize + tileSize / 2;
      const cz = minZ + r * tileSize + tileSize / 2;
      return layout.rooms.some(
        (room) =>
          cx >= room.x - eps && cx <= room.x + room.width + eps &&
          cz >= room.z - eps && cz <= room.z + room.depth + eps,
      );
    }),
  );

  const pieces = buildWallPieces(layout, tileSize);
  const edges = new Uint8Array(cols * rows * 8);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!inside[r][c]) continue;
      const x0 = minX + c * tileSize + tileSize / 2;
      const z0 = minZ + r * tileSize + tileSize / 2;
      for (let d = 0; d < 8; d++) {
        const nc = c + DIRS[d][0];
        const nr = r + DIRS[d][1];
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows || !inside[nr][nc]) continue;
        const x1 = minX + nc * tileSize + tileSize / 2;
        const z1 = minZ + nr * tileSize + tileSize / 2;
        if (pieces.some((pc) => segmentHitsPiece(pc, x0, z0, x1, z1))) {
          edges[(r * cols + c) * 8 + d] = 1;
        }
      }
    }
  }

  return { minX, minZ, cols, rows, tileSize, inside, edges, pieces };
}

function buildPathData(layout: ApartmentLayout, furniture: PlacedFurniture[], base: WalkBase): PathData {
  const { minX, minZ, cols, rows, tileSize, inside, edges, pieces } = base;
  const walkable: boolean[][] = inside.map((row) => [...row]);
  const toCol = (x: number) => Math.floor((x - minX) / tileSize);
  const toRow = (z: number) => Math.floor((z - minZ) / tileSize);

  // Furniture blocks its tiles
  for (const entry of furniture) {
    const item = FURNITURE_BY_ID[entry.itemId];
    const room = layout.rooms.find((r) => r.id === entry.roomId);
    if (!item || !room) continue;
    if (item.flat) continue;
    const size = footprint(item, entry.rotation);
    const { cols: roomCols, rows: roomRows } = roomTiles(room);
    const cellWidth = room.width / roomCols;
    const cellDepth = room.depth / roomRows;
    const physW = size.w * tileSize;
    const physD = size.d * tileSize;
    const worldCenterX = room.x + entry.col * cellWidth + physW / 2;
    const worldCenterZ = room.z + entry.row * cellDepth + physD / 2;
    const startCol = toCol(worldCenterX - physW / 2);
    const endCol = toCol(worldCenterX + physW / 2 - 0.001);
    const startRow = toRow(worldCenterZ - physD / 2);
    const endRow = toRow(worldCenterZ + physD / 2 - 0.001);
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        if (r >= 0 && r < rows && c >= 0 && c < cols) walkable[r][c] = false;
      }
    }
  }

  return { grid: { cols, rows, walkable }, originX: minX, originZ: minZ, tileSize, edges, pieces };
}

function stepOk(pd: PathData, c: number, r: number, d: number): boolean {
  const { cols, rows, walkable } = pd.grid;
  const nc = c + DIRS[d][0];
  const nr = r + DIRS[d][1];
  if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) return false;
  if (!walkable[nr][nc]) return false;
  return pd.edges[(r * cols + c) * 8 + d] === 0;
}

function canMove(pd: PathData, c: number, r: number, d: number): boolean {
  if (!stepOk(pd, c, r, d)) return false;
  if (d >= 4) {
    // No cutting corners through walls or furniture
    const horizontal = DIRS[d][0] > 0 ? 1 : 3;
    const vertical = DIRS[d][1] > 0 ? 2 : 0;
    return stepOk(pd, c, r, horizontal) && stepOk(pd, c, r, vertical);
  }
  return true;
}

/** Shortest walking distance from `start` to every reachable tile. */
function floodFrom(pd: PathData, start: GridNode): { dist: Float32Array; prev: Int32Array } {
  const { cols, rows } = pd.grid;
  const n = cols * rows;
  const dist = new Float32Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const inOpen = new Uint8Array(n);
  const open: number[] = [];

  const s = start.row * cols + start.col;
  dist[s] = 0;
  open.push(s);
  inOpen[s] = 1;

  while (open.length > 0) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (dist[open[i]] < dist[open[bi]]) bi = i;
    const cur = open[bi];
    open[bi] = open[open.length - 1];
    open.pop();
    inOpen[cur] = 0;

    const c = cur % cols;
    const r = (cur - c) / cols;
    for (let d = 0; d < 8; d++) {
      if (!canMove(pd, c, r, d)) continue;
      const ni = (r + DIRS[d][1]) * cols + (c + DIRS[d][0]);
      const nd = dist[cur] + (d < 4 ? 1 : Math.SQRT2);
      if (nd < dist[ni]) {
        dist[ni] = nd;
        prev[ni] = cur;
        if (!inOpen[ni]) { open.push(ni); inOpen[ni] = 1; }
      }
    }
  }
  return { dist, prev };
}

function buildPath(prev: Int32Array, cols: number, goal: GridNode): GridNode[] {
  const path: GridNode[] = [];
  let cur = goal.row * cols + goal.col;
  while (cur !== -1) {
    const c = cur % cols;
    path.push({ col: c, row: (cur - c) / cols });
    cur = prev[cur];
  }
  return path.reverse();
}

function nearestWalkable(grid: PathfindingGrid, node: GridNode, radius = 4): GridNode | null {
  const ok = (n: GridNode) =>
    n.row >= 0 && n.row < grid.rows && n.col >= 0 && n.col < grid.cols && grid.walkable[n.row][n.col];
  if (ok(node)) return node;
  let best: GridNode | null = null;
  let bestDist = Infinity;
  for (let r = -radius; r <= radius; r++) {
    for (let c = -radius; c <= radius; c++) {
      const cand = { row: node.row + r, col: node.col + c };
      if (ok(cand)) {
        const d = Math.abs(r) + Math.abs(c);
        if (d < bestDist) { bestDist = d; best = cand; }
      }
    }
  }
  return best;
}

/** Floor tap: the reachable tile closest to where the player tapped. */
function pickClickNode(pd: PathData, dist: Float32Array, x: number, z: number): GridNode | null {
  const { cols, rows } = pd.grid;
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < cols * rows; i++) {
    if (!isFinite(dist[i])) continue;
    const c = i % cols;
    const r = (i - c) / cols;
    const cx = pd.originX + c * pd.tileSize + pd.tileSize / 2;
    const cz = pd.originZ + r * pd.tileSize + pd.tileSize / 2;
    const d = Math.hypot(cx - x, cz - z);
    if (d < bestD) { bestD = d; best = i; }
  }
  if (best < 0 || bestD > pd.tileSize * 2.5) return null;
  const c = best % cols;
  return { col: c, row: (best - c) / cols };
}

/** Furniture: the nearest reachable tile right next to it, with nothing (walls) in between. */
function pickApproachNode(pd: PathData, dist: Float32Array, it: Interaction): GridNode | null {
  const { cols, rows } = pd.grid;
  const ring = pd.tileSize * 1.05;
  let best = -1;
  let bestScore = Infinity;
  for (let i = 0; i < cols * rows; i++) {
    if (!isFinite(dist[i])) continue;
    const c = i % cols;
    const r = (i - c) / cols;
    if (!pd.grid.walkable[r][c]) continue;
    const cx = pd.originX + c * pd.tileSize + pd.tileSize / 2;
    const cz = pd.originZ + r * pd.tileSize + pd.tileSize / 2;
    if (cx < it.x - it.halfW - ring || cx > it.x + it.halfW + ring) continue;
    if (cz < it.z - it.halfD - ring || cz > it.z + it.halfD + ring) continue;
    if (segmentBlocked(pd, cx, cz, it.x, it.z)) continue; // wall in between
    const score = dist[i] + Math.hypot(cx - it.x, cz - it.z) * 0.01;
    if (score < bestScore) { bestScore = score; best = i; }
  }
  if (best < 0) return null;
  const c = best % cols;
  return { col: c, row: (best - c) / cols };
}

function PlayerCharacter({
  layout, appearance, command, pathData, onReachDoor, onInteractionArrived, onInteractionBlocked,
}: {
  layout: ApartmentLayout;
  appearance: CharacterAppearance;
  command: PlayerCommand | null;
  pathData: PathData;
  onReachDoor: () => void;
  onInteractionArrived?: (uid: string) => void;
  onInteractionBlocked?: (uid: string) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const characterGroupRef = useRef<THREE.Group>(null);
  const [action, setActionState] = useState<CharacterAction>("idle");
  const actionRef = useRef<CharacterAction>("idle");
  const pathRef = useRef<GridNode[]>([]);
  const currentStepRef = useRef(0);
  const progressRef = useRef(0);
  const doorTriggeredRef = useRef(false);
  const pendingRef = useRef<Interaction | null>(null);
  const standPosRef = useRef<{ x: number; z: number } | null>(null);
  const actionTimerRef = useRef<number | null>(null);
  const pathDataRef = useRef(pathData);
  const onArrivedRef = useRef(onInteractionArrived);
  const onBlockedRef = useRef(onInteractionBlocked);

  useEffect(() => { pathDataRef.current = pathData; }, [pathData]);
  useEffect(() => { onArrivedRef.current = onInteractionArrived; }, [onInteractionArrived]);
  useEffect(() => { onBlockedRef.current = onInteractionBlocked; }, [onInteractionBlocked]);

  const setAction = useCallback((next: CharacterAction) => {
    actionRef.current = next;
    setActionState(next);
  }, []);

  const clearActionTimer = useCallback(() => {
    if (actionTimerRef.current !== null) {
      window.clearTimeout(actionTimerRef.current);
      actionTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearActionTimer(), [clearActionTimer]);

  // After "work" / "shower" the character relaxes by himself
  const autoIdle = useCallback((pose: CharacterAction, seconds: number) => {
    clearActionTimer();
    actionTimerRef.current = window.setTimeout(() => {
      actionTimerRef.current = null;
      if (actionRef.current === pose) setAction("idle");
    }, seconds * 1000);
  }, [clearActionTimer, setAction]);

  const room = layout.rooms[0];
  const startX = room ? room.x + room.width / 2 : 0;
  const startZ = room ? room.z + room.depth / 2 : 0;

  // The character has reached the furniture: sit / lie / enter / work on it
  const applyInteraction = useCallback((it: Interaction) => {
    const player = groupRef.current;
    if (!player) return;

    pathRef.current = [];
    currentStepRef.current = 0;
    progressRef.current = 0;
    clearActionTimer();

    const fromX = player.position.x;
    const fromZ = player.position.z;

    if (it.mode === "near") {
      // Stand against the furniture, face it, hands on it
      const px = Math.min(Math.max(fromX, it.x - it.halfW), it.x + it.halfW);
      const pz = Math.min(Math.max(fromZ, it.z - it.halfD), it.z + it.halfD);
      const dx = fromX - px;
      const dz = fromZ - pz;
      const d = Math.hypot(dx, dz);
      standPosRef.current = null;
      if (d > 0.001) {
        const off = Math.min(STAND_OFF, d);
        player.position.set(px + (dx / d) * off, FLOOR_Y, pz + (dz / d) * off);
        if (characterGroupRef.current) characterGroupRef.current.rotation.y = Math.atan2(-dx, -dz);
      } else if (characterGroupRef.current) {
        characterGroupRef.current.rotation.y = Math.atan2(it.x - fromX, it.z - fromZ);
      }
      setAction("work");
      autoIdle("work", WORK_SECONDS);
    } else {
      // Snap onto the furniture; remember where he came from so he can step back out
      standPosRef.current = { x: fromX, z: fromZ };
      player.position.set(it.x, FLOOR_Y + it.yAdjust, it.z);
      let rotation = it.rotationY;
      if (it.faceApproach) {
        const dx = it.x - fromX;
        const dz = it.z - fromZ;
        if (Math.abs(dx) + Math.abs(dz) > 0.01) rotation = Math.atan2(dx, dz);
      }
      if (characterGroupRef.current) characterGroupRef.current.rotation.y = rotation;
      setAction(it.pose);
      if (it.pose === "shower") autoIdle("shower", SHOWER_SECONDS);
    }

    const uid = it.uid;
    queueMicrotask(() => onArrivedRef.current?.(uid));
  }, [autoIdle, clearActionTimer, setAction]);

  // New command: floor tap or "use this furniture"
  useEffect(() => {
    const player = groupRef.current;
    const pd = pathDataRef.current;
    if (!command || !player || !pd) return;

    clearActionTimer();
    const { grid, originX, originZ, tileSize } = pd;
    const toNode = (x: number, z: number): GridNode => ({
      col: Math.floor((x - originX) / tileSize),
      row: Math.floor((z - originZ) / tileSize),
    });

    pendingRef.current = command.interact ?? null;
    pathRef.current = [];
    currentStepRef.current = 0;
    progressRef.current = 0;

    // Where does the walk start? If he was sitting / lying / inside the shower, from where he stepped in.
    const standPos = standPosRef.current;
    standPosRef.current = null;
    const rawStart = standPos ? toNode(standPos.x, standPos.z) : toNode(player.position.x, player.position.z);
    const startNode = nearestWalkable(grid, rawStart);
    if (!startNode) {
      pendingRef.current = null;
      if (command.interact) onBlockedRef.current?.(command.interact.uid);
      return;
    }
    const snapped =
      !!standPos || startNode.col !== rawStart.col || startNode.row !== rawStart.row ||
      actionRef.current === "sit" || actionRef.current === "lay";
    if (snapped || player.position.y !== FLOOR_Y) {
      player.position.set(
        originX + startNode.col * tileSize + tileSize / 2,
        FLOOR_Y,
        originZ + startNode.row * tileSize + tileSize / 2,
      );
    }

    const { dist, prev } = floodFrom(pd, startNode);
    const goalNode = command.interact
      ? pickApproachNode(pd, dist, command.interact)
      : pickClickNode(pd, dist, command.x, command.z);

    if (!goalNode) {
      // Nothing reachable
      pendingRef.current = null;
      if (command.interact) onBlockedRef.current?.(command.interact.uid);
      if (actionRef.current !== "idle") setAction("idle");
      return;
    }

    const path = buildPath(prev, grid.cols, goalNode);
    if (path.length > 1) {
      pathRef.current = path;
      currentStepRef.current = 1;
      progressRef.current = 0;
      setAction("walk");
      return;
    }

    // Already standing at the right spot
    if (command.interact) {
      pendingRef.current = null;
      setTimeout(() => applyInteraction(command.interact!), 0);
    } else if (actionRef.current !== "idle") {
      setTimeout(() => setAction("idle"), 0);
    }
  }, [command, applyInteraction, clearActionTimer, setAction]);

  // TEMPORARY test keys: S = sit, L = lie down, I = stand up.
  // Handy to check the poses on their own. Delete when you no longer need them.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      const key = e.key.toLowerCase();
      if (key !== "s" && key !== "l" && key !== "i") return;
      pathRef.current = [];
      pendingRef.current = null;
      clearActionTimer();
      if (groupRef.current) groupRef.current.position.y = FLOOR_Y;
      setAction(key === "s" ? "sit" : key === "l" ? "lay" : "idle");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearActionTimer, setAction]);

  useFrame((_, delta) => {
    const player = groupRef.current;
    if (!player) return;
    const path = pathRef.current;
    if (path.length === 0 || currentStepRef.current >= path.length) {
      if (actionRef.current === "walk") setAction("idle");
      return;
    }
    const { originX, originZ, tileSize } = pathData;
    const currentTargetNode = path[currentStepRef.current];
    const prevNode = path[currentStepRef.current - 1] ?? path[0];
    const targetX = originX + currentTargetNode.col * tileSize + tileSize / 2;
    const targetZ = originZ + currentTargetNode.row * tileSize + tileSize / 2;

    const dirX = targetX - player.position.x;
    const dirZ = targetZ - player.position.z;
    if (characterGroupRef.current && (Math.abs(dirX) > 0.01 || Math.abs(dirZ) > 0.01)) {
      characterGroupRef.current.rotation.y = Math.atan2(dirX, dirZ);
    }

    const speed = 5;
    const stepLength = Math.max(
      0.001,
      Math.hypot(currentTargetNode.col - prevNode.col, currentTargetNode.row - prevNode.row) * tileSize,
    );
    progressRef.current += (speed * delta) / stepLength;

    if (progressRef.current >= 1) {
      player.position.x = targetX;
      player.position.z = targetZ;
      currentStepRef.current += 1;
      progressRef.current = 0;

      if (currentStepRef.current >= path.length) {
        pathRef.current = [];
        const pending = pendingRef.current;
        pendingRef.current = null;

        if (pending) {
          applyInteraction(pending);
        } else {
          setAction("idle");
          if (!doorTriggeredRef.current) {
            const lastNode = path[path.length - 1];
            const endX = originX + lastNode.col * tileSize + tileSize / 2;
            const endZ = originZ + lastNode.row * tileSize + tileSize / 2;
            const nearDoor = layout.walls.some((wall) => {
              const openings = layout.openings.filter((o) => o.wallId === wall.id && o.type === "door");
              if (openings.length === 0) return false;
              const dx = wall.end[0] - wall.start[0];
              const dz = wall.end[1] - wall.start[1];
              const len = Math.hypot(dx, dz);
              if (len < 0.001) return false;
              const t = ((endX - wall.start[0]) * dx + (endZ - wall.start[1]) * dz) / (len * len);
              if (t < 0 || t > 1) return false;
              const projX = wall.start[0] + dx * t;
              const projZ = wall.start[1] + dz * t;
              const dist = Math.hypot(endX - projX, endZ - projZ);
              if (dist > 0.8) return false;
              const along = t * len;
              return openings.some((op) => Math.abs(along - op.position) < op.width / 2 + 0.2);
            });
            if (nearDoor) {
              doorTriggeredRef.current = true;
              onReachDoor();
            }
          }
        }
      }
    } else {
      const prevX = originX + prevNode.col * tileSize + tileSize / 2;
      const prevZ = originZ + prevNode.row * tileSize + tileSize / 2;
      player.position.x = prevX + (targetX - prevX) * progressRef.current;
      player.position.z = prevZ + (targetZ - prevZ) * progressRef.current;
    }
  });

  return (
    <group ref={groupRef} position={[startX, FLOOR_Y, startZ]}>
      <group ref={characterGroupRef}>
        <CharacterModel appearance={appearance} targetHeight={1.8} action={action} targetRotation={0} />
      </group>
    </group>
  );
}

function ApartmentShell({ layout, furniture, onSelectFurniture, onFloorClick, movingUid, isValid, onExitToMap, isNight }: {
  layout: ApartmentLayout; furniture: PlacedFurniture[];
  onSelectFurniture: (uid: string) => void;
  onFloorClick: (x: number, z: number) => void;
  movingUid: string | null; isValid: boolean; onExitToMap?: () => void; isNight: boolean;
}) {
  const wallColor = getWallColor(layout.id);

  const longWalls = useMemo(() => {
    return [...layout.walls]
      .filter(w => w.style !== "railing" && w.height > 1)
      .sort((a, b) => {
        const lenA = Math.hypot(a.end[0] - a.start[0], a.end[1] - a.start[1]);
        const lenB = Math.hypot(b.end[0] - b.start[0], b.end[1] - b.start[1]);
        return lenB - lenA;
      })
      .slice(0, 2);
  }, [layout.walls]);

  return (
    <group>
      {layout.rooms.map((room) => <RoomFloor key={room.id} room={room} onFloorClick={onFloorClick} />)}

      {layout.walls.map((wall) => <ApartmentWallView key={wall.id} wall={wall} openings={layout.openings} wallColor={wallColor} onExitToMap={onExitToMap} />)}

      {longWalls.map((wall) => {
        const midX = (wall.start[0] + wall.end[0]) / 2;
        const midZ = (wall.start[1] + wall.end[1]) / 2;

        const room = layout.rooms[0];
        const centerX = room ? room.x + room.width / 2 : 0;
        const centerZ = room ? room.z + room.depth / 2 : 0;

        const angleToCenter = Math.atan2(centerX - midX, centerZ - midZ);
        const rotationY = angleToCenter;

        return (
          <WallLight
            key={`light-${wall.id}`}
            layoutId={layout.id}
            isNight={isNight}
            position={[midX, 2.0, midZ]}
            rotation={[0, rotationY, 0]}
          />
        );
      })}

      {layout.id === "two-bedroom" && <WoodenStaircase />}
      <FurnitureLayer
        layout={layout}
        furniture={furniture}
        onSelectFurniture={onSelectFurniture}
        movingUid={movingUid}
        isValid={isValid}
      />
    </group>
  );
}

export default function Apartment({
  layout, furniture = [], appearance = DEFAULT_CHARACTER_APPEARANCE,
  controlsEnabled = true, isNight = false, onSelectFurniture, onExitToMap,
  movingUid = null, editingMode = false, movingIsValid = true,
  interactionRequest = null, onInteractionArrived, onInteractionBlocked,
}: {
  layout: ApartmentLayout; furniture?: PlacedFurniture[]; appearance?: CharacterAppearance;
  controlsEnabled?: boolean; isNight?: boolean; onSelectFurniture: (uid: string) => void;
  onExitToMap?: () => void; movingUid?: string | null;
  editingMode?: boolean; movingIsValid?: boolean;
  interactionRequest?: InteractionRequest | null;
  onInteractionArrived?: (uid: string) => void;
  onInteractionBlocked?: (uid: string) => void;
}) {
  const { target, zoom } = layout.camera;
  const cameraPosition: [number, number, number] = [target[0] + 18, 14, target[2] + 18];
  const skyColor = isNight ? NIGHT_SKY : DAY_SKY;

  const [command, setCommand] = useState<PlayerCommand | null>(null);
  const commandId = useRef(0);
  const lastRequestToken = useRef<number | null>(null);

  // Rooms + walls never change for a layout; furniture does
  const walkBase = useMemo(() => buildWalkBase(layout), [layout]);
  const pathData = useMemo(() => buildPathData(layout, furniture, walkBase), [layout, furniture, walkBase]);

  const handleFloorClick = useCallback((x: number, z: number) => {
    if (editingMode) return;
    commandId.current += 1;
    setCommand({ id: commandId.current, x, z });
  }, [editingMode]);

  // HomeInterior asked: "walk to this furniture and use it"
  useEffect(() => {
    if (!interactionRequest) return;
    if (lastRequestToken.current === interactionRequest.token) return;
    lastRequestToken.current = interactionRequest.token;

    const entry = furniture.find((f) => f.uid === interactionRequest.uid);
    if (!entry) return;
    const interaction = buildInteraction(layout, entry);
    if (!interaction) return;

    commandId.current += 1;
    setCommand({ id: commandId.current, x: interaction.x, z: interaction.z, interact: interaction });
  }, [interactionRequest, furniture, layout]);

  return (
    <Canvas key={layout.id} orthographic shadows dpr={[1, 1.25]} camera={{ position: cameraPosition, zoom, near: 1, far: 60 }} gl={{ antialias: true, alpha: false }}>
      <color attach="background" args={[skyColor]} />

      <ambientLight intensity={isNight ? 0.4 : 1.4} color={isNight ? "#6c7eb3" : "#ffe8ce"} />
      <hemisphereLight args={isNight ? ["#2a3b5c", "#0a0a0a", 0.4] : ["#fff6e7", "#a0816b", 1.2]} />
      <directionalLight
        position={[target[0] - 10, isNight ? 8 : 20, target[2] + 12]}
        intensity={isNight ? 0.1 : 2.5}
        color={isNight ? "#556699" : "#fff0db"}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-bias={-0.0001}
      />

      <ApartmentShell
        layout={layout}
        furniture={furniture}
        onSelectFurniture={onSelectFurniture}
        onFloorClick={handleFloorClick}
        movingUid={movingUid}
        isValid={movingIsValid}
        onExitToMap={onExitToMap}
        isNight={isNight}
      />

      <PlayerCharacter
        layout={layout}
        appearance={appearance}
        command={command}
        pathData={pathData}
        onReachDoor={() => onExitToMap?.()}
        onInteractionArrived={onInteractionArrived}
        onInteractionBlocked={onInteractionBlocked}
      />

      <OrbitControls makeDefault enabled={controlsEnabled} enableRotate={controlsEnabled} enableZoom={controlsEnabled} enablePan={false} minZoom={zoom * 0.8} maxZoom={zoom * 1.2} minPolarAngle={0.45} maxPolarAngle={1.35} target={target} />
    </Canvas>
  );
}