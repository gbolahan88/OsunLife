"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  APARTMENT_GLASS_COLOR, APARTMENT_SKIRTING_COLOR, APARTMENT_TOP_EDGE_COLOR,
  DEFAULT_TILE_SIZE,
  TWO_BED_WALL_COLOR, PARLOUR_WALL_COLOR, SELF_CON_WALL_COLOR,
  type ApartmentLayout, type ApartmentOpening, type ApartmentRoom, type ApartmentWall,
} from "@/lib/apartmentConfig";
import {
  FURNITURE_BY_ID, footprint, roomTiles, validateFurniturePlacement,
  type FurnitureItem, type PlacedFurniture,
} from "@/lib/furniture";
import CharacterModel from "@/components/game/CharacterModel";
import { CharacterAppearance, DEFAULT_CHARACTER_APPEARANCE } from "@/store/characterAppearance";
import { findPath, type GridNode, type PathfindingGrid } from "@/lib/pathfinding";

const DAY_SKY = "#dfd6c9";
const NIGHT_SKY = "#1a1a2e";
const FLOOR_Y = 0.015;

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

// ✅ NEW: A dedicated Window component that centers vertically
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
    
    // ✅ Center on all axes FOR WINDOWS ONLY
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
    <group position={[(wall.start[0] + wall.end[0]) / 2, 0, (wall.start[1] + wall.end[1]) / 2]} rotation={[0, rotation, 0]}>
      
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

      {/* ✅ DOOR (Clickable to exit) */}
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

      {/* ✅ WINDOWS (Using the new WindowModel) */}
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

// ✅ FIXED: Furniture uses -box.min.y so it sits perfectly on the floor
function GLTFModel({ url, targetWidth, targetDepth, targetHeight }: { url: string; targetWidth: number; targetDepth: number; targetHeight: number; }) {
  const { scene } = useGLTF(url);
  const { clonedScene, scale, offset } = useMemo(() => {
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
      -box.min.y * scaleY, // ✅ Sits on the floor
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
    "generator": { url: "/models/generator.glb", height: 0.6 },
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
    case "generator": return (<><B p={[0, 0.35, 0]} s={[W * 0.9, 0.5, D * 0.9]} c="#d9402f" /></>);
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
            <group position={[x, FLOOR_Y, z]} rotation={[0, entry.rotation * Math.PI / 2, 0]} onClick={(event) => { event.stopPropagation(); onSelectFurniture(entry.uid); }}>
              <FurnitureModel item={item} W={item.w * tile} D={item.d * tile} />
            </group>
          </group>
        );
      })}
    </group>
  );
}

// ✅ NO wall blocking. Only blocks tiles outside room bounds and tiles with furniture.
function buildWalkableGrid(layout: ApartmentLayout, furniture: PlacedFurniture[]): {
  grid: PathfindingGrid;
  originX: number;
  originZ: number;
  tileSize: number;
} {
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
  const walkable: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(true));
  const toCol = (x: number) => Math.floor((x - minX) / tileSize);
  const toRow = (z: number) => Math.floor((z - minZ) / tileSize);

  // Block tiles OUTSIDE the room bounds
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = minX + c * tileSize;
      const wz = minZ + r * tileSize;
      if (wx < minX - 0.001 || wx >= maxX || wz < minZ - 0.001 || wz >= maxZ) {
        walkable[r][c] = false;
      }
    }
  }

  // Block furniture cells — nothing else.
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

  return { grid: { cols, rows, walkable }, originX: minX, originZ: minZ, tileSize };
}

function PlayerCharacter({
  layout, appearance, targetPos, pathData, onReachDoor,
}: {
  layout: ApartmentLayout;
  appearance: CharacterAppearance;
  targetPos: [number, number, number] | null;
  pathData: { grid: PathfindingGrid; originX: number; originZ: number; tileSize: number } | null;
  onReachDoor: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const characterGroupRef = useRef<THREE.Group>(null);
  const [isWalking, setIsWalking] = useState(false);
  const pathRef = useRef<GridNode[]>([]);
  const currentStepRef = useRef(0);
  const progressRef = useRef(0);
  const doorTriggeredRef = useRef(false);

  const room = layout.rooms[0];
  const startX = room ? room.x + room.width / 2 : 0;
  const startZ = room ? room.z + room.depth / 2 : 0;

  useEffect(() => {
    if (!targetPos || !pathData || !groupRef.current) return;
    const { grid, originX, originZ, tileSize } = pathData;
    const startWorld = groupRef.current.position;
    const startNode: GridNode = {
      col: Math.floor((startWorld.x - originX) / tileSize),
      row: Math.floor((startWorld.z - originZ) / tileSize),
    };
    const goalNode: GridNode = {
      col: Math.floor((targetPos[0] - originX) / tileSize),
      row: Math.floor((targetPos[2] - originZ) / tileSize),
    };

    let finalGoal = goalNode;
    const inBounds = (n: GridNode) => n.row >= 0 && n.row < grid.rows && n.col >= 0 && n.col < grid.cols;

    if (!inBounds(goalNode) || !grid.walkable[goalNode.row][goalNode.col]) {
      let best: GridNode | null = null;
      let bestDist = Infinity;
      for (let r = -3; r <= 3; r++) {
        for (let c = -3; c <= 3; c++) {
          const cand = { row: goalNode.row + r, col: goalNode.col + c };
          if (inBounds(cand) && grid.walkable[cand.row][cand.col]) {
            const d = Math.abs(r) + Math.abs(c);
            if (d < bestDist) { bestDist = d; best = cand; }
          }
        }
      }
      if (best) finalGoal = best;
      else return;
    }

    const path = findPath(grid, startNode, finalGoal);
    if (path && path.length > 1) {
      pathRef.current = path;
      currentStepRef.current = 1;
      progressRef.current = 0;
      setIsWalking(true);
    }
  }, [targetPos, pathData]);

  useFrame((_, delta) => {
    const player = groupRef.current;
    if (!player || !pathData) return;
    const path = pathRef.current;
    if (path.length === 0 || currentStepRef.current >= path.length) {
      if (isWalking) setIsWalking(false);
      return;
    }
    const { originX, originZ, tileSize } = pathData;
    const currentTargetNode = path[currentStepRef.current];
    const targetX = originX + currentTargetNode.col * tileSize + tileSize / 2;
    const targetZ = originZ + currentTargetNode.row * tileSize + tileSize / 2;

    const dirX = targetX - player.position.x;
    const dirZ = targetZ - player.position.z;
    if (characterGroupRef.current && (Math.abs(dirX) > 0.01 || Math.abs(dirZ) > 0.01)) {
      characterGroupRef.current.rotation.y = Math.atan2(dirX, dirZ);
    }

    const speed = 5;
    progressRef.current += (speed * delta) / tileSize;
    if (progressRef.current >= 1) {
      player.position.x = targetX;
      player.position.z = targetZ;
      currentStepRef.current += 1;
      progressRef.current = 0;

      if (currentStepRef.current >= path.length) {
        setIsWalking(false);
        pathRef.current = [];
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
    } else {
      const prevNode = path[currentStepRef.current - 1];
      const startX = originX + prevNode.col * tileSize + tileSize / 2;
      const startZ = originZ + prevNode.row * tileSize + tileSize / 2;
      player.position.x = startX + (targetX - startX) * progressRef.current;
      player.position.z = startZ + (targetZ - startZ) * progressRef.current;
    }
  });

  return (
    <group ref={groupRef} position={[startX, FLOOR_Y, startZ]}>
      <group ref={characterGroupRef}>
        <CharacterModel appearance={appearance} targetHeight={1.8} isWalking={isWalking} targetRotation={0} />
      </group>
    </group>
  );
}

function ApartmentShell({ layout, furniture, onSelectFurniture, onFloorClick, movingUid, isValid, onExitToMap, isNight }: {
  layout: ApartmentLayout; furniture: PlacedFurniture[];
  onSelectFurniture: (uid: string) => void; onFloorClick: (x: number, z: number) => void;
  movingUid: string | null; isValid: boolean; onExitToMap?: () => void; isNight: boolean;
}) {
  const wallColor = getWallColor(layout.id);
  
  // Find the two longest walls to place the lights on
  const longWalls = useMemo(() => {
    return [...layout.walls]
      .filter(w => w.style !== "railing" && w.height > 1)
      .sort((a, b) => {
        const lenA = Math.hypot(a.end[0] - a.start[0], a.end[1] - a.start[1]);
        const lenB = Math.hypot(b.end[0] - b.start[0], b.end[1] - b.start[1]);
        return lenB - lenA;
      })
      .slice(0, 2); // Only take the top 2 longest walls
  }, [layout.walls]);

  return (
    <group>
      {layout.rooms.map((room) => <RoomFloor key={room.id} room={room} onFloorClick={onFloorClick} />)}
      
      {layout.walls.map((wall) => <ApartmentWallView key={wall.id} wall={wall} openings={layout.openings} wallColor={wallColor} onExitToMap={onExitToMap} />)}

      {/* ✅ Add Wall Lights to the longest walls */}
      {longWalls.map((wall) => {
        const dx = wall.end[0] - wall.start[0];
        const dz = wall.end[1] - wall.start[1];
        const midX = (wall.start[0] + wall.end[0]) / 2;
        const midZ = (wall.start[1] + wall.end[1]) / 2;

        const room = layout.rooms[0]; // Get the main room
        const centerX = room ? room.x + room.width / 2 : 0;
        const centerZ = room ? room.z + room.depth / 2 : 0;
        
        // Math to find the angle between the wall and the room center
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
      })
}

      {layout.id === "two-bedroom" && <WoodenStaircase />}
      <FurnitureLayer layout={layout} furniture={furniture} onSelectFurniture={onSelectFurniture} movingUid={movingUid} isValid={isValid} />
    </group>
  );
}

export default function Apartment({
  layout, furniture = [], appearance = DEFAULT_CHARACTER_APPEARANCE,
  controlsEnabled = true, isNight = false, onSelectFurniture, onExitToMap,
  movingUid = null, editingMode = false, movingIsValid = true,
}: {
  layout: ApartmentLayout; furniture?: PlacedFurniture[]; appearance?: CharacterAppearance;
  controlsEnabled?: boolean; isNight?: boolean; onSelectFurniture: (uid: string) => void;
  onExitToMap?: () => void; movingUid?: string | null;
  editingMode?: boolean; movingIsValid?: boolean;
}) {
  const { target, zoom } = layout.camera;
  const cameraPosition: [number, number, number] = [target[0] + 18, 14, target[2] + 18];
  const skyColor = isNight ? NIGHT_SKY : DAY_SKY;

  const [playerTarget, setPlayerTarget] = useState<[number, number, number] | null>(null);

  const pathData = useMemo(() => buildWalkableGrid(layout, furniture), [layout, furniture]);

  return (
    <Canvas key={layout.id} orthographic shadows dpr={[1, 1.25]} camera={{ position: cameraPosition, zoom, near: 1, far: 60 }} gl={{ antialias: true, alpha: false }}>
      <color attach="background" args={[skyColor]} />
      
      {/* ✅ Dim the sun at night so wall lights are visible */}
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
        onFloorClick={(x, z) => {
          if (!editingMode) setPlayerTarget([x, FLOOR_Y, z]);
        }}
        movingUid={movingUid}
        isValid={movingIsValid}
        onExitToMap={onExitToMap}
        isNight={isNight}
      />

      <PlayerCharacter
        layout={layout}
        appearance={appearance}
        targetPos={playerTarget}
        pathData={pathData}
        onReachDoor={() => onExitToMap?.()}
      />

      <OrbitControls makeDefault enabled={controlsEnabled} enableRotate={controlsEnabled} enableZoom={controlsEnabled} enablePan={false} minZoom={zoom * 0.8} maxZoom={zoom * 1.2} minPolarAngle={0.45} maxPolarAngle={1.35} target={target} />
    </Canvas>
  );
}