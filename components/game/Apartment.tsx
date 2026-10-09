"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import {
  APARTMENT_GLASS_COLOR,
  APARTMENT_OPENINGS,
  APARTMENT_ROOMS,
  APARTMENT_SKIRTING_COLOR,
  APARTMENT_TOP_EDGE_COLOR,
  APARTMENT_WALL_COLOR,
  APARTMENT_WALLS,
  DEFAULT_TILE_SIZE,
  type ApartmentOpening,
  type ApartmentRoom,
  type ApartmentWall,
} from "@/lib/apartmentConfig";

const SKY_COLOR = "#b8d8e8";
const FLOOR_Y = 0.015;

function useCheckerTexture(room: ApartmentRoom) {
  const texture = useMemo(() => {
    if (room.floorDark === undefined || typeof document === "undefined") return null;

    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
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
    nextTexture.repeat.set(room.width / (tileSize * 2), room.depth / (tileSize * 2));
    nextTexture.colorSpace = THREE.SRGBColorSpace;
    nextTexture.anisotropy = 4;
    return nextTexture;
  }, [room]);

  useEffect(() => () => texture?.dispose(), [texture]);

  return texture;
}

function RoomFloor({ room }: { room: ApartmentRoom }) {
  const texture = useCheckerTexture(room);
  const centerX = room.x + room.width / 2;
  const centerZ = room.z + room.depth / 2;

  return (
    <mesh
      position={[centerX, FLOOR_Y, centerZ]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[room.width, room.depth]} />
      {texture ? (
        <meshStandardMaterial map={texture} roughness={0.92} />
      ) : (
        <meshStandardMaterial color={room.floorLight} roughness={0.92} />
      )}
    </mesh>
  );
}

function WallMaterial({ style }: { style: ApartmentWall["style"] }) {
  if (style === "glass") {
    return (
      <meshStandardMaterial
        color={APARTMENT_GLASS_COLOR}
        transparent
        opacity={0.4}
        roughness={0.24}
        metalness={0.05}
        side={THREE.DoubleSide}
      />
    );
  }

  return <meshStandardMaterial color={APARTMENT_WALL_COLOR} roughness={0.9} />;
}

function WallBox({
  x,
  y,
  width,
  height,
  thickness,
  style,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  thickness: number;
  style: ApartmentWall["style"];
}) {
  if (width <= 0 || height <= 0) return null;

  return (
    <mesh position={[x, y, 0]} castShadow receiveShadow>
      <boxGeometry args={[width, height, thickness]} />
      <WallMaterial style={style} />
    </mesh>
  );
}

function OpeningGlass({
  opening,
  thickness,
}: {
  opening: ApartmentOpening;
  thickness: number;
}) {
  const sill = opening.sillHeight ?? 0;
  const paneColumns = opening.paneColumns ?? 1;
  const paneRows = opening.paneRows ?? 1;
  const glassZ = thickness / 2 + 0.012;
  const archGeometry = useMemo(() => {
    if (opening.type !== "arch") return null;
    const shape = new THREE.Shape();
    const radius = opening.width / 2;
    const springHeight = Math.max(0, opening.height - radius);
    shape.moveTo(-radius, 0);
    shape.lineTo(radius, 0);
    shape.lineTo(radius, springHeight);
    shape.absarc(0, springHeight, radius, 0, Math.PI, false);
    shape.closePath();
    return new THREE.ShapeGeometry(shape, 20);
  }, [opening.height, opening.type, opening.width]);

  useEffect(() => () => archGeometry?.dispose(), [archGeometry]);

  if (opening.type === "arch") {
    return (
      <mesh
        geometry={archGeometry!}
        position={[opening.position, sill, glassZ]}
      >
        <meshStandardMaterial
          color={APARTMENT_GLASS_COLOR}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
          roughness={0.22}
        />
      </mesh>
    );
  }

  return (
    <group position={[opening.position, sill, glassZ]}>
      <mesh position={[0, opening.height / 2, 0]}>
        <boxGeometry args={[opening.width - 0.08, opening.height - 0.08, 0.025]} />
        <meshStandardMaterial
          color={APARTMENT_GLASS_COLOR}
          transparent
          opacity={0.48}
          roughness={0.22}
        />
      </mesh>
      {Array.from({ length: paneColumns - 1 }, (_, index) => {
        const x = -opening.width / 2 + ((index + 1) * opening.width) / paneColumns;
        return (
          <mesh key={`column-${index}`} position={[x, opening.height / 2, 0.025]}>
            <boxGeometry args={[0.045, opening.height, 0.05]} />
            <meshStandardMaterial color="#f5ead7" roughness={0.85} />
          </mesh>
        );
      })}
      {Array.from({ length: paneRows - 1 }, (_, index) => {
        const y = ((index + 1) * opening.height) / paneRows;
        return (
          <mesh key={`row-${index}`} position={[0, y, 0.025]}>
            <boxGeometry args={[opening.width, 0.045, 0.05]} />
            <meshStandardMaterial color="#f5ead7" roughness={0.85} />
          </mesh>
        );
      })}
    </group>
  );
}

function OpeningFrame({
  opening,
  thickness,
}: {
  opening: ApartmentOpening;
  thickness: number;
}) {
  if (opening.type === "open") return null;

  if (opening.type === "door") {
    return (
      <group position={[opening.position, 0, thickness / 2 + 0.035]}>
        <mesh position={[0, opening.height / 2, 0]} castShadow>
          <boxGeometry args={[opening.width - 0.09, opening.height - 0.05, 0.07]} />
          <meshStandardMaterial color="#68452f" roughness={0.84} />
        </mesh>
        <mesh position={[opening.width * 0.34, opening.height / 2, 0.045]}>
          <sphereGeometry args={[0.045, 8, 8]} />
          <meshStandardMaterial color="#d0aa67" metalness={0.55} roughness={0.35} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * (opening.width / 2 + 0.035), opening.height / 2, 0]}>
            <boxGeometry args={[0.08, opening.height + 0.08, thickness + 0.05]} />
            <meshStandardMaterial color="#f3e7d2" roughness={0.88} />
          </mesh>
        ))}
        <mesh position={[0, opening.height + 0.04, 0]}>
          <boxGeometry args={[opening.width + 0.14, 0.08, thickness + 0.05]} />
          <meshStandardMaterial color="#f3e7d2" roughness={0.88} />
        </mesh>
      </group>
    );
  }

  const sill = opening.sillHeight ?? 0;
  return (
    <group position={[opening.position, sill, thickness / 2 + 0.03]}>
      <mesh position={[-opening.width / 2, opening.height / 2, 0]}>
        <boxGeometry args={[0.07, opening.height, thickness + 0.06]} />
        <meshStandardMaterial color="#f3e7d2" roughness={0.85} />
      </mesh>
      <mesh position={[opening.width / 2, opening.height / 2, 0]}>
        <boxGeometry args={[0.07, opening.height, thickness + 0.06]} />
        <meshStandardMaterial color="#f3e7d2" roughness={0.85} />
      </mesh>
      {opening.type === "arch" ? (
        <mesh position={[0, opening.height - opening.width / 2, 0]}>
          <torusGeometry args={[opening.width / 2, 0.045, 6, 24, Math.PI]} />
          <meshStandardMaterial color="#f3e7d2" roughness={0.85} />
        </mesh>
      ) : (
        <mesh position={[0, opening.height, 0]}>
          <boxGeometry args={[opening.width + 0.08, 0.07, thickness + 0.06]} />
          <meshStandardMaterial color="#f3e7d2" roughness={0.85} />
        </mesh>
      )}
      <mesh position={[0, -0.025, 0]}>
        <boxGeometry args={[opening.width + 0.08, 0.07, thickness + 0.06]} />
        <meshStandardMaterial color="#f3e7d2" roughness={0.85} />
      </mesh>
    </group>
  );
}

function BalconyRailing({ length }: { length: number }) {
  const postCount = Math.max(2, Math.ceil(length / 1.3) + 1);
  return (
    <>
      {[0.48, 0.98].map((height) => (
        <mesh key={height} position={[0, height, 0]} castShadow>
          <boxGeometry args={[length, 0.09, 0.1]} />
          <meshStandardMaterial color="#f8f4eb" roughness={0.72} />
        </mesh>
      ))}
      {Array.from({ length: postCount }, (_, index) => {
        const x = -length / 2 + (index * length) / (postCount - 1);
        return (
          <mesh key={index} position={[x, 0.52, 0]} castShadow>
            <boxGeometry args={[0.09, 1.04, 0.12]} />
            <meshStandardMaterial color="#fffdf8" roughness={0.72} />
          </mesh>
        );
      })}
    </>
  );
}

function ApartmentWall({ wall }: { wall: ApartmentWall }) {
  const dx = wall.end[0] - wall.start[0];
  const dz = wall.end[1] - wall.start[1];
  const length = Math.hypot(dx, dz);
  const openings = APARTMENT_OPENINGS
    .filter((opening) => opening.wallId === wall.id)
    .sort((first, second) => first.position - second.position);
  const rotation = -Math.atan2(dz, dx);
  const style = wall.style ?? "wall";

  if (style === "railing") {
    return (
      <group
        position={[(wall.start[0] + wall.end[0]) / 2, 0, (wall.start[1] + wall.end[1]) / 2]}
        rotation={[0, rotation, 0]}
      >
        <BalconyRailing length={length} />
      </group>
    );
  }

  const intervals = new Set<number>([0, length]);
  for (const opening of openings) {
    const start = Math.max(0, opening.position - opening.width / 2);
    const end = Math.min(length, opening.position + opening.width / 2);
    intervals.add(start);
    intervals.add(end);
    if (opening.type === "arch") {
      for (let step = 1; step < 20; step += 1) {
        intervals.add(start + ((end - start) * step) / 20);
      }
    }
  }

  const edges = Array.from(intervals).sort((first, second) => first - second);
  const centerOffset = length / 2;

  return (
    <group
      position={[(wall.start[0] + wall.end[0]) / 2, 0, (wall.start[1] + wall.end[1]) / 2]}
      rotation={[0, rotation, 0]}
    >
      {edges.slice(0, -1).map((start, index) => {
        const end = edges[index + 1];
        const midpoint = (start + end) / 2;
        const opening = openings.find((item) => Math.abs(midpoint - item.position) < item.width / 2);
        const left = start - centerOffset;
        const width = end - start;
        const segmentOpeningTop = opening?.type === "arch"
          ? (opening.sillHeight ?? 0) + Math.min(
              opening.height,
              Math.max(0, opening.height - opening.width / 2) +
                Math.sqrt(Math.max(0, (opening.width / 2) ** 2 - (midpoint - opening.position) ** 2)),
            )
          : (opening?.sillHeight ?? 0) + (opening?.height ?? 0);
        const holeBottom = opening && (opening.type === "door" || opening.type === "open")
          ? 0
          : opening?.sillHeight ?? 0;
        const hasFloorOpening = opening && (opening.type === "door" || opening.type === "open");

        return (
          <group key={`${wall.id}-${index}`}>
            {!opening ? (
              <WallBox
                x={left + width / 2}
                y={wall.height / 2}
                width={width}
                height={wall.height}
                thickness={wall.thickness}
                style={style}
              />
            ) : (
              <>
                <WallBox
                  x={left + width / 2}
                  y={holeBottom / 2}
                  width={width}
                  height={holeBottom}
                  thickness={wall.thickness}
                  style={style}
                />
                <WallBox
                  x={left + width / 2}
                  y={(segmentOpeningTop + wall.height) / 2}
                  width={width}
                  height={wall.height - segmentOpeningTop}
                  thickness={wall.thickness}
                  style={style}
                />
              </>
            )}
            {!hasFloorOpening && (
              <mesh position={[left + width / 2, 0.07, wall.thickness / 2 + 0.015]}>
                <boxGeometry args={[width, 0.14, 0.04]} />
                <meshStandardMaterial color={APARTMENT_SKIRTING_COLOR} roughness={0.82} />
              </mesh>
            )}
          </group>
        );
      })}
      <mesh position={[0, wall.height - 0.025, wall.thickness / 2 + 0.015]}>
        <boxGeometry args={[length, 0.05, wall.thickness + 0.035]} />
        <meshStandardMaterial color={APARTMENT_TOP_EDGE_COLOR} roughness={0.82} />
      </mesh>
      {openings.map((opening) => (
        <group key={`${wall.id}-${opening.position}`}>
          {opening.type === "window" || opening.type === "arch" ? (
            <OpeningGlass
              opening={{ ...opening, position: opening.position - centerOffset }}
              thickness={wall.thickness}
            />
          ) : null}
          <OpeningFrame
            opening={{ ...opening, position: opening.position - centerOffset }}
            thickness={wall.thickness}
          />
        </group>
      ))}
    </group>
  );
}

function ApartmentShell() {
  return (
    <group>
      {APARTMENT_ROOMS.map((room, index) => (
        <RoomFloor key={`${room.id}-${index}`} room={room} />
      ))}
      {APARTMENT_WALLS.map((wall) => (
        <ApartmentWall key={wall.id} wall={wall} />
      ))}
    </group>
  );
}

export default function Apartment({ controlsEnabled = true }: { controlsEnabled?: boolean }) {
  return (
    <Canvas
      orthographic
      shadows
      dpr={[1, 1.25]}
      camera={{ position: [15, 18, 19], zoom: 32, near: 0.1, far: 100 }}
      gl={{ antialias: true, alpha: false }}
    >
      <color attach="background" args={[SKY_COLOR]} />
      <ambientLight intensity={1.3} />
      <hemisphereLight args={["#fff6e7", "#718378", 1.25]} />
      <directionalLight
        position={[-9, 16, 11]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <ApartmentShell />
      <OrbitControls
        makeDefault
        enabled={controlsEnabled}
        enableRotate={controlsEnabled}
        enableZoom={controlsEnabled}
        enablePan={false}
        minZoom={19}
        maxZoom={48}
        minPolarAngle={0.45}
        maxPolarAngle={1.42}
        target={[1.5, 0, 1.5]}
      />
    </Canvas>
  );
}