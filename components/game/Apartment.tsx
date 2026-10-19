
"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, SoftShadows } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import {
  APARTMENT_GLASS_COLOR,
  APARTMENT_PLATFORM_COLOR,
  APARTMENT_SKIRTING_COLOR,
  APARTMENT_TOP_EDGE_COLOR,
  APARTMENT_WALL_COLOR,
  DEFAULT_TILE_SIZE,
  type ApartmentLayout,
  type ApartmentOpening,
  type ApartmentRoom,
  type ApartmentStairs,
  type ApartmentWall,
  type StairDirection,
} from "@/lib/apartmentConfig";
import {
  FURNITURE_BY_ID,
  footprint,
  roomTiles,
  type FurnitureItem,
  type PlacedFurniture,
} from "@/lib/furniture";
import CharacterModel from "@/components/game/CharacterModel";
import {
  CharacterAppearance,
  DEFAULT_CHARACTER_APPEARANCE,
} from "@/store/characterAppearance";

const FLOOR_Y = 0.015;

type RoomWithElevation = ApartmentRoom & {
  elevation?: number;
};

type WallWithElevation = ApartmentWall & {
  elevation?: number;
};

type LayoutWithStairs = ApartmentLayout & {
  stairs?: ApartmentStairs[];
};

function getRoomElevation(room: ApartmentRoom): number {
  return (room as RoomWithElevation).elevation ?? 0;
}

function getWallElevation(wall: ApartmentWall): number {
  return (wall as WallWithElevation).elevation ?? 0;
}

function useCheckerTexture(room: ApartmentRoom) {
  const texture = useMemo(() => {
    if (room.floorDark === undefined || typeof document === "undefined") {
      return null;
    }

    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;

    const context = canvas.getContext("2d");
    if (!context) return null;

    const squareSize = canvas.width / 2;

    for (let row = 0; row < 2; row += 1) {
      for (let column = 0; column < 2; column += 1) {
        context.fillStyle =
          (row + column) % 2 === 0 ? room.floorLight : room.floorDark;

        context.fillRect(
          column * squareSize,
          row * squareSize,
          squareSize,
          squareSize,
        );
      }
    }

    const nextTexture = new THREE.CanvasTexture(canvas);
    const tileSize = room.tileSize ?? DEFAULT_TILE_SIZE;
    const visualColumns = room.width / tileSize;
    const visualRows = room.depth / tileSize;

    nextTexture.wrapS = THREE.RepeatWrapping;
    nextTexture.wrapT = THREE.RepeatWrapping;
    nextTexture.repeat.set(visualColumns / 2, visualRows / 2);
    nextTexture.colorSpace = THREE.SRGBColorSpace;
    nextTexture.anisotropy = 4;

    return nextTexture;
  }, [
    room.floorDark,
    room.floorLight,
    room.tileSize,
    room.width,
    room.depth,
  ]);

  useEffect(() => {
    return () => texture?.dispose();
  }, [texture]);

  return texture;
}

function RoomFloor({ room }: { room: ApartmentRoom }) {
  const texture = useCheckerTexture(room);
  const elevation = getRoomElevation(room);
  const centerX = room.x + room.width / 2;
  const centerZ = room.z + room.depth / 2;

  return (
    <group>
      {elevation > 0 && (
        <mesh
          position={[centerX, elevation / 2, centerZ]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[room.width, elevation, room.depth]} />
          <meshStandardMaterial
            color={APARTMENT_PLATFORM_COLOR}
            roughness={0.9}
          />
        </mesh>
      )}

      <mesh
        position={[centerX, FLOOR_Y + elevation, centerZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[room.width, room.depth]} />

        {texture ? (
          <meshStandardMaterial map={texture} roughness={0.92} />
        ) : (
          <meshStandardMaterial
            color={room.floorLight}
            roughness={0.92}
          />
        )}
      </mesh>
    </group>
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

  return (
    <meshStandardMaterial
      color={APARTMENT_WALL_COLOR}
      roughness={0.9}
    />
  );
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
  if (width <= 0 || height <= 0 || thickness <= 0) {
    return null;
  }

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
  const paneColumns = Math.max(1, opening.paneColumns ?? 1);
  const paneRows = Math.max(1, opening.paneRows ?? 1);
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

  useEffect(() => {
    return () => archGeometry?.dispose();
  }, [archGeometry]);

  if (opening.type === "arch") {
    if (!archGeometry) return null;

    return (
      <mesh
        geometry={archGeometry}
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
        <boxGeometry
          args={[
            Math.max(0, opening.width - 0.08),
            Math.max(0, opening.height - 0.08),
            0.025,
          ]}
        />
        <meshStandardMaterial
          color={APARTMENT_GLASS_COLOR}
          transparent
          opacity={0.48}
          roughness={0.22}
        />
      </mesh>

      {Array.from({ length: paneColumns - 1 }, (_, index) => {
        const x =
          -opening.width / 2 +
          ((index + 1) * opening.width) / paneColumns;

        return (
          <mesh
            key={`column-${index}`}
            position={[x, opening.height / 2, 0.025]}
          >
            <boxGeometry args={[0.045, opening.height, 0.05]} />
            <meshStandardMaterial
              color="#f5ead7"
              roughness={0.85}
            />
          </mesh>
        );
      })}

      {Array.from({ length: paneRows - 1 }, (_, index) => {
        const y = ((index + 1) * opening.height) / paneRows;

        return (
          <mesh
            key={`row-${index}`}
            position={[0, y, 0.025]}
          >
            <boxGeometry args={[opening.width, 0.045, 0.05]} />
            <meshStandardMaterial
              color="#f5ead7"
              roughness={0.85}
            />
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
      <group
        position={[
          opening.position,
          0,
          thickness / 2 + 0.035,
        ]}
      >
        <mesh position={[0, opening.height / 2, 0]} castShadow>
          <boxGeometry
            args={[
              Math.max(0.05, opening.width - 0.09),
              Math.max(0.05, opening.height - 0.05),
              0.07,
            ]}
          />
          <meshStandardMaterial
            color="#68452f"
            roughness={0.84}
          />
        </mesh>

        <mesh
          position={[
            opening.width * 0.34,
            opening.height / 2,
            0.045,
          ]}
        >
          <sphereGeometry args={[0.045, 8, 8]} />
          <meshStandardMaterial
            color="#d0aa67"
            metalness={0.55}
            roughness={0.35}
          />
        </mesh>

        {[-1, 1].map((side) => (
          <mesh
            key={side}
            position={[
              side * (opening.width / 2 + 0.035),
              opening.height / 2,
              0,
            ]}
          >
            <boxGeometry
              args={[
                0.08,
                opening.height + 0.08,
                thickness + 0.05,
              ]}
            />
            <meshStandardMaterial
              color="#f3e7d2"
              roughness={0.88}
            />
          </mesh>
        ))}

        <mesh position={[0, opening.height + 0.04, 0]}>
          <boxGeometry
            args={[
              opening.width + 0.14,
              0.08,
              thickness + 0.05,
            ]}
          />
          <meshStandardMaterial
            color="#f3e7d2"
            roughness={0.88}
          />
        </mesh>
      </group>
    );
  }

  const sill = opening.sillHeight ?? 0;

  return (
    <group
      position={[
        opening.position,
        sill,
        thickness / 2 + 0.03,
      ]}
    >
      <mesh
        position={[
          -opening.width / 2,
          opening.height / 2,
          0,
        ]}
      >
        <boxGeometry
          args={[0.07, opening.height, thickness + 0.06]}
        />
        <meshStandardMaterial
          color="#f3e7d2"
          roughness={0.85}
        />
      </mesh>

      <mesh
        position={[
          opening.width / 2,
          opening.height / 2,
          0,
        ]}
      >
        <boxGeometry
          args={[0.07, opening.height, thickness + 0.06]}
        />
        <meshStandardMaterial
          color="#f3e7d2"
          roughness={0.85}
        />
      </mesh>

      {opening.type === "arch" ? (
        <mesh
          position={[
            0,
            opening.height - opening.width / 2,
            0,
          ]}
        >
          <torusGeometry
            args={[
              opening.width / 2,
              0.045,
              6,
              24,
              Math.PI,
            ]}
          />
          <meshStandardMaterial
            color="#f3e7d2"
            roughness={0.85}
          />
        </mesh>
      ) : (
        <mesh position={[0, opening.height, 0]}>
          <boxGeometry
            args={[
              opening.width + 0.08,
              0.07,
              thickness + 0.06,
            ]}
          />
          <meshStandardMaterial
            color="#f3e7d2"
            roughness={0.85}
          />
        </mesh>
      )}

      <mesh position={[0, -0.025, 0]}>
        <boxGeometry
          args={[
            opening.width + 0.08,
            0.07,
            thickness + 0.06,
          ]}
        />
        <meshStandardMaterial
          color="#f3e7d2"
          roughness={0.85}
        />
      </mesh>
    </group>
  );
}

function BalconyRailing({ length }: { length: number }) {
  const postCount = Math.max(2, Math.ceil(length / 1.3) + 1);

  return (
    <>
      {[0.48, 0.98].map((height) => (
        <mesh
          key={height}
          position={[0, height, 0]}
          castShadow
        >
          <boxGeometry args={[length, 0.09, 0.1]} />
          <meshStandardMaterial
            color="#f8f4eb"
            roughness={0.72}
          />
        </mesh>
      ))}

      {Array.from({ length: postCount }, (_, index) => {
        const x =
          -length / 2 +
          (index * length) / (postCount - 1);

        return (
          <mesh
            key={index}
            position={[x, 0.52, 0]}
            castShadow
          >
            <boxGeometry args={[0.09, 1.04, 0.12]} />
            <meshStandardMaterial
              color="#fffdf8"
              roughness={0.72}
            />
          </mesh>
        );
      })}
    </>
  );
}

function ApartmentWallView({
  wall,
  openings: allOpenings,
}: {
  wall: ApartmentWall;
  openings: ApartmentOpening[];
}) {
  const dx = wall.end[0] - wall.start[0];
  const dz = wall.end[1] - wall.start[1];
  const length = Math.hypot(dx, dz);

  const openings = allOpenings
    .filter((opening) => opening.wallId === wall.id)
    .sort((first, second) => first.position - second.position);

  const rotation = -Math.atan2(dz, dx);
  const style = wall.style ?? "wall";
  const baseY = getWallElevation(wall);

  if (length <= 0) return null;

  if (style === "railing") {
    return (
      <group
        position={[
          (wall.start[0] + wall.end[0]) / 2,
          baseY,
          (wall.start[1] + wall.end[1]) / 2,
        ]}
        rotation={[0, rotation, 0]}
      >
        <BalconyRailing length={length} />
      </group>
    );
  }

  const intervals = new Set<number>([0, length]);

  for (const opening of openings) {
    const start = Math.max(
      0,
      opening.position - opening.width / 2,
    );
    const end = Math.min(
      length,
      opening.position + opening.width / 2,
    );

    intervals.add(start);
    intervals.add(end);

    if (opening.type === "arch") {
      for (let step = 1; step < 20; step += 1) {
        intervals.add(start + ((end - start) * step) / 20);
      }
    }
  }

  const edges = Array.from(intervals).sort(
    (first, second) => first - second,
  );

  const centerOffset = length / 2;

  return (
    <group
      position={[
        (wall.start[0] + wall.end[0]) / 2,
        baseY,
        (wall.start[1] + wall.end[1]) / 2,
      ]}
      rotation={[0, rotation, 0]}
    >
      {edges.slice(0, -1).map((start, index) => {
        const end = edges[index + 1];
        const width = end - start;

        if (width <= 0) return null;

        const midpoint = (start + end) / 2;

        const opening = openings.find(
          (item) =>
            midpoint >= item.position - item.width / 2 &&
            midpoint <= item.position + item.width / 2,
        );

        const segmentOpeningTop =
          opening?.type === "arch"
            ? (opening.sillHeight ?? 0) +
              Math.min(
                opening.height,
                Math.max(
                  0,
                  opening.height - opening.width / 2,
                ) +
                  Math.sqrt(
                    Math.max(
                      0,
                      (opening.width / 2) ** 2 -
                        (midpoint - opening.position) ** 2,
                    ),
                  ),
              )
            : (opening?.sillHeight ?? 0) +
              (opening?.height ?? 0);

        const holeBottom =
          opening &&
          (opening.type === "door" || opening.type === "open")
            ? 0
            : opening?.sillHeight ?? 0;

        const hasFloorOpening =
          opening?.type === "door" ||
          opening?.type === "open";

        const safeOpeningTop = Math.min(
          wall.height,
          Math.max(0, segmentOpeningTop),
        );

        const safeHoleBottom = Math.min(
          safeOpeningTop,
          Math.max(0, holeBottom),
        );

        const localX = start - centerOffset + width / 2;

        return (
          <group key={`${wall.id}-${index}`}>
            {!opening ? (
              <WallBox
                x={localX}
                y={wall.height / 2}
                width={width}
                height={wall.height}
                thickness={wall.thickness}
                style={style}
              />
            ) : (
              <>
                <WallBox
                  x={localX}
                  y={safeHoleBottom / 2}
                  width={width}
                  height={safeHoleBottom}
                  thickness={wall.thickness}
                  style={style}
                />

                <WallBox
                  x={localX}
                  y={(safeOpeningTop + wall.height) / 2}
                  width={width}
                  height={Math.max(
                    0,
                    wall.height - safeOpeningTop,
                  )}
                  thickness={wall.thickness}
                  style={style}
                />
              </>
            )}

            {!hasFloorOpening && (
              <mesh
                position={[
                  localX,
                  0.07,
                  wall.thickness / 2 + 0.015,
                ]}
              >
                <boxGeometry
                  args={[width, 0.14, 0.04]}
                />
                <meshStandardMaterial
                  color={APARTMENT_SKIRTING_COLOR}
                  roughness={0.82}
                />
              </mesh>
            )}
          </group>
        );
      })}

      <mesh
        position={[
          0,
          wall.height - 0.025,
          wall.thickness / 2 + 0.015,
        ]}
      >
        <boxGeometry
          args={[
            length,
            0.05,
            wall.thickness + 0.035,
          ]}
        />
        <meshStandardMaterial
          color={APARTMENT_TOP_EDGE_COLOR}
          roughness={0.82}
        />
      </mesh>

      {openings.map((opening) => (
        <group
          key={`${wall.id}-${opening.position}`}
        >
          {opening.type === "window" ||
          opening.type === "arch" ? (
            <OpeningGlass
              opening={{
                ...opening,
                position: opening.position - centerOffset,
              }}
              thickness={wall.thickness}
            />
          ) : null}

          <OpeningFrame
            opening={{
              ...opening,
              position: opening.position - centerOffset,
            }}
            thickness={wall.thickness}
          />
        </group>
      ))}
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/* Stairs                                                                      */
/* -------------------------------------------------------------------------- */

const STAIR_ROTATION: Record<StairDirection, number> = {
  east: 0,
  west: Math.PI,
  north: Math.PI / 2,
  south: -Math.PI / 2,
};

function StairsView({ stairs }: { stairs: ApartmentStairs }) {
  const {
    length,
    width,
    steps: requestedSteps,
    rise,
    direction,
  } = stairs;

  const steps = Math.max(1, Math.floor(requestedSteps));
  const safeLength = Math.max(0.1, length);
  const safeWidth = Math.max(0.1, width);
  const safeRise = Math.max(0.01, rise);

  const rail = stairs.rail ?? true;
  const railSide = stairs.railSide ?? 1;

  const horizontal =
    direction === "east" || direction === "west";

  const centerX =
    stairs.x + (horizontal ? safeLength : safeWidth) / 2;

  const centerZ =
    stairs.z + (horizontal ? safeWidth : safeLength) / 2;

  const treadRun = safeLength / steps;
  const railRise = 0.9;

  const firstX = -safeLength / 2 + treadRun / 2;
  const lastX = safeLength / 2 - treadRun / 2;
  const railDx = lastX - firstX;
  const railDy = (steps - 1) * safeRise;
  const railLength = Math.hypot(railDx, railDy);
  const railAngle = Math.atan2(railDy, railDx);
  const railCenterY =
    (safeRise + steps * safeRise) / 2 + railRise;

  const railZ = railSide * (safeWidth / 2 - 0.05);

  return (
    <group
      position={[centerX, FLOOR_Y, centerZ]}
      rotation={[0, STAIR_ROTATION[direction], 0]}
    >
      {Array.from({ length: steps }, (_, index) => {
        const height = (index + 1) * safeRise;

        return (
          <B
            key={`step-${index}`}
            p={[
              -safeLength / 2 + (index + 0.5) * treadRun,
              height / 2,
              0,
            ]}
            s={[treadRun, height, safeWidth]}
            c={index % 2 === 0 ? "#9a6a45" : "#8a5a3a"}
            rough={0.85}
          />
        );
      })}

      {rail && (
        <>
          {Array.from({ length: steps }, (_, index) => {
            if (index % 2 !== 0 && index !== steps - 1) {
              return null;
            }

            const stepTop = (index + 1) * safeRise;

            return (
              <B
                key={`post-${index}`}
                p={[
                  -safeLength / 2 +
                    (index + 0.5) * treadRun,
                  stepTop + railRise / 2,
                  railZ,
                ]}
                s={[0.04, railRise, 0.04]}
                c="#2b2018"
              />
            );
          })}

          {railLength > 0 && (
            <mesh
              position={[0, railCenterY, railZ]}
              rotation={[0, 0, railAngle]}
              castShadow
            >
              <boxGeometry
                args={[railLength, 0.05, 0.05]}
              />
              <meshStandardMaterial
                color="#2b2018"
                roughness={0.6}
              />
            </mesh>
          )}
        </>
      )}
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/* Furniture                                                                   */
/* -------------------------------------------------------------------------- */

type BoxProps = {
  p: [number, number, number];
  s: [number, number, number];
  c: string;
  metal?: number;
  rough?: number;
  emissive?: string;
};

function B({
  p,
  s,
  c,
  metal = 0,
  rough = 0.8,
  emissive,
}: BoxProps) {
  return (
    <mesh position={p} castShadow receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial
        color={c}
        metalness={metal}
        roughness={rough}
        emissive={emissive}
        emissiveIntensity={emissive ? 0.6 : 0}
      />
    </mesh>
  );
}

function Cyl({
  p,
  r,
  h,
  c,
  metal = 0,
}: {
  p: [number, number, number];
  r: number;
  h: number;
  c: string;
  metal?: number;
}) {
  return (
    <mesh position={p} castShadow>
      <cylinderGeometry args={[r, r, h, 14]} />
      <meshStandardMaterial
        color={c}
        metalness={metal}
        roughness={0.6}
      />
    </mesh>
  );
}

function FurnitureModel({
  item,
  W,
  D,
}: {
  item: FurnitureItem;
  W: number;
  D: number;
}) {
  switch (item.model) {
    case "mattress":
      return (
        <>
          <B p={[0, 0.12, 0]} s={[W, 0.24, D]} c="#e8d9b8" />
          <B
            p={[0, 0.26, -D * 0.38]}
            s={[W * 0.7, 0.1, 0.3]}
            c="#ffffff"
          />
          <B
            p={[0, 0.25, D * 0.12]}
            s={[W * 0.96, 0.06, D * 0.7]}
            c="#5f8fb0"
          />
        </>
      );

    case "bed":
      return (
        <>
          <B p={[0, 0.16, 0]} s={[W, 0.32, D]} c="#6d4a33" />
          <B
            p={[0, 0.42, 0.04]}
            s={[W * 0.94, 0.22, D * 0.94]}
            c="#f2ece0"
          />
          <B
            p={[0, 0.75, -D / 2 + 0.05]}
            s={[W, 0.9, 0.1]}
            c="#5a3b28"
          />
          <B
            p={[-W * 0.22, 0.6, -D * 0.38]}
            s={[W * 0.36, 0.1, 0.34]}
            c="#ffffff"
          />
          <B
            p={[W * 0.22, 0.6, -D * 0.38]}
            s={[W * 0.36, 0.1, 0.34]}
            c="#ffffff"
          />
          <B
            p={[0, 0.56, D * 0.16]}
            s={[W * 0.96, 0.08, D * 0.6]}
            c="#c0504a"
          />
        </>
      );

    case "wardrobe":
      return (
        <>
          <B p={[0, 0.95, 0]} s={[W, 1.9, D]} c="#7a5236" />
          <B
            p={[-W * 0.25, 0.95, D / 2 + 0.01]}
            s={[W * 0.46, 1.8, 0.03]}
            c="#8d6444"
          />
          <B
            p={[W * 0.25, 0.95, D / 2 + 0.01]}
            s={[W * 0.46, 1.8, 0.03]}
            c="#8d6444"
          />
          <B
            p={[-0.06, 0.95, D / 2 + 0.04]}
            s={[0.04, 0.3, 0.04]}
            c="#d0aa67"
            metal={0.6}
          />
          <B
            p={[0.06, 0.95, D / 2 + 0.04]}
            s={[0.04, 0.3, 0.04]}
            c="#d0aa67"
            metal={0.6}
          />
        </>
      );

    case "fan":
      return (
        <>
          <Cyl p={[0, 0.03, 0]} r={0.22} h={0.06} c="#d9dde0" />
          <Cyl
            p={[0, 0.55, 0]}
            r={0.025}
            h={1.1}
            c="#bfc6ca"
            metal={0.4}
          />
          <mesh
            position={[0, 1.12, 0.02]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <cylinderGeometry args={[0.24, 0.24, 0.05, 20]} />
            <meshStandardMaterial
              color="#9fc4d9"
              transparent
              opacity={0.75}
            />
          </mesh>
        </>
      );

    case "sofa":
      return (
        <>
          <B p={[0, 0.2, 0]} s={[W, 0.4, D]} c="#8b5a3c" />
          <B
            p={[0, 0.5, D * 0.08]}
            s={[W * 0.86, 0.22, D * 0.62]}
            c="#b37a55"
          />
          <B
            p={[0, 0.62, -D / 2 + 0.12]}
            s={[W, 0.7, 0.24]}
            c="#7b4d32"
          />
          <B
            p={[-W / 2 + 0.1, 0.45, 0]}
            s={[0.2, 0.55, D]}
            c="#7b4d32"
          />
          <B
            p={[W / 2 - 0.1, 0.45, 0]}
            s={[0.2, 0.55, D]}
            c="#7b4d32"
          />
        </>
      );

    case "table":
      return (
        <>
          <B p={[0, 0.38, 0]} s={[W, 0.06, D]} c="#8d6444" />
          {[-1, 1].flatMap((x) =>
            [-1, 1].map((z) => (
              <B
                key={`${x}${z}`}
                p={[
                  x * (W / 2 - 0.06),
                  0.18,
                  z * (D / 2 - 0.06),
                ]}
                s={[0.06, 0.36, 0.06]}
                c="#5a3b28"
              />
            )),
          )}
        </>
      );

    case "tv":
      return (
        <>
          <B
            p={[0, 0.25, 0]}
            s={[W, 0.5, D * 0.9]}
            c="#5a3b28"
          />
          <B
            p={[0, 0.95, 0]}
            s={[W * 0.8, 0.8, 0.07]}
            c="#15181a"
            emissive="#203848"
          />
          <B
            p={[0, 0.54, 0]}
            s={[0.3, 0.08, 0.2]}
            c="#2a2d30"
          />
        </>
      );

    case "dining":
      return (
        <>
          <B
            p={[0, 0.7, 0]}
            s={[W * 0.6, 0.06, D * 0.6]}
            c="#8d6444"
          />
          {[-1, 1].flatMap((x) =>
            [-1, 1].map((z) => (
              <B
                key={`${x}${z}`}
                p={[x * W * 0.26, 0.35, z * D * 0.26]}
                s={[0.06, 0.7, 0.06]}
                c="#5a3b28"
              />
            )),
          )}
          {[
            [0, -D * 0.42, 0],
            [0, D * 0.42, 0],
            [-W * 0.42, 0, 0],
            [W * 0.42, 0, 0],
          ].map(([x, z], index) => (
            <group key={index} position={[x, 0, z]}>
              <B
                p={[0, 0.4, 0]}
                s={[0.36, 0.06, 0.36]}
                c="#c9a36a"
              />
              <B
                p={[0, 0.2, 0]}
                s={[0.3, 0.4, 0.3]}
                c="#7a5236"
              />
            </group>
          ))}
        </>
      );

    case "fridge":
      return (
        <>
          <B
            p={[0, 0.85, 0]}
            s={[W * 0.9, 1.7, D * 0.9]}
            c="#e9edee"
            metal={0.2}
            rough={0.4}
          />
          <B
            p={[0, 1.15, D * 0.45 + 0.01]}
            s={[W * 0.88, 0.02, 0.02]}
            c="#9aa3a6"
          />
          <B
            p={[W * 0.34, 1.35, D * 0.46 + 0.03]}
            s={[0.04, 0.3, 0.04]}
            c="#9aa3a6"
            metal={0.6}
          />
          <B
            p={[W * 0.34, 0.8, D * 0.46 + 0.03]}
            s={[0.04, 0.4, 0.04]}
            c="#9aa3a6"
            metal={0.6}
          />
        </>
      );

    case "cooker":
      return (
        <>
          <B
            p={[0, 0.42, 0]}
            s={[W * 0.92, 0.84, D * 0.92]}
            c="#d7dadb"
            metal={0.3}
            rough={0.45}
          />
          <B
            p={[0, 0.86, 0]}
            s={[W * 0.92, 0.04, D * 0.92]}
            c="#2b2e30"
          />
          {[-1, 1].flatMap((x) =>
            [-1, 1].map((z) => (
              <Cyl
                key={`${x}${z}`}
                p={[
                  x * W * 0.2,
                  0.9,
                  z * D * 0.2,
                ]}
                r={0.07}
                h={0.04}
                c="#8b8f91"
                metal={0.6}
              />
            )),
          )}
          <B
            p={[0, 0.4, D * 0.46 + 0.01]}
            s={[W * 0.7, 0.4, 0.02]}
            c="#2b2e30"
          />
        </>
      );

    case "washer":
      return (
        <>
          <B
            p={[0, 0.45, 0]}
            s={[W * 0.92, 0.9, D * 0.92]}
            c="#f1f3f4"
            rough={0.4}
          />
          <mesh
            position={[0, 0.45, D * 0.46 + 0.01]}
            castShadow
          >
            <cylinderGeometry args={[0.2, 0.2, 0.04, 20]} />
            <meshStandardMaterial
              color="#6f8fa3"
              metalness={0.3}
              roughness={0.3}
            />
          </mesh>
          <B
            p={[0, 0.82, D * 0.46 + 0.01]}
            s={[W * 0.7, 0.06, 0.02]}
            c="#8a9396"
          />
        </>
      );

    case "generator":
      return (
        <>
          <B
            p={[0, 0.35, 0]}
            s={[W * 0.9, 0.5, D * 0.9]}
            c="#d9402f"
          />
          <B
            p={[0, 0.65, 0]}
            s={[W * 0.7, 0.12, D * 0.6]}
            c="#2b2e30"
          />
          <B
            p={[0, 0.06, 0]}
            s={[W, 0.1, D]}
            c="#3a3d40"
          />
          <B
            p={[W * 0.25, 0.4, D * 0.46 + 0.01]}
            s={[0.12, 0.12, 0.02]}
            c="#f2d04a"
          />
        </>
      );

    case "rug":
      return (
        <>
          <B
            p={[0, 0.015, 0]}
            s={[W, 0.03, D]}
            c="#b4513f"
            rough={1}
          />
          <B
            p={[0, 0.032, 0]}
            s={[W * 0.8, 0.01, D * 0.78]}
            c="#e5c585"
            rough={1}
          />
        </>
      );

    case "dispenser":
      return (
        <>
          <B
            p={[0, 0.5, 0]}
            s={[W * 0.7, 1, D * 0.7]}
            c="#dfe7ea"
          />
          <Cyl
            p={[0, 1.2, 0]}
            r={0.16}
            h={0.4}
            c="#6fb4e0"
          />
          <B
            p={[0, 0.7, D * 0.35 + 0.01]}
            s={[0.16, 0.06, 0.02]}
            c="#3b82b6"
          />
        </>
      );

    case "plant":
      return (
        <>
          <Cyl
            p={[0, 0.17, 0]}
            r={0.17}
            h={0.34}
            c="#b4673c"
          />
          <mesh position={[0, 0.58, 0]} castShadow>
            <icosahedronGeometry args={[0.28, 1]} />
            <meshStandardMaterial
              color="#3f8f4f"
              roughness={0.9}
            />
          </mesh>
        </>
      );

    default:
      return (
        <B
          p={[0, 0.3, 0]}
          s={[W, 0.6, D]}
          c="#999999"
        />
      );
  }
}

function FurnitureLayer({
  layout,
  furniture,
}: {
  layout: ApartmentLayout;
  furniture: PlacedFurniture[];
}) {
  return (
    <group>
      {furniture.map((entry) => {
        const item = FURNITURE_BY_ID[entry.itemId];
        const room = layout.rooms.find(
          (candidate) => candidate.id === entry.roomId,
        );

        if (!item || !room) return null;

        const tile = room.tileSize ?? DEFAULT_TILE_SIZE;
        const { cols, rows } = roomTiles(room);
        const cellWidth = room.width / cols;
        const cellDepth = room.depth / rows;
        const size = footprint(item, entry.rotated);
        const physicalWidth = size.w * tile;
        const physicalDepth = size.d * tile;

        const x =
          room.x +
          entry.col * cellWidth +
          physicalWidth / 2;

        const z =
          room.z +
          entry.row * cellDepth +
          physicalDepth / 2;

        const margin = item.flat ? 0.04 : 0.08;
        const y = FLOOR_Y + getRoomElevation(room);

        return (
          <group
            key={entry.uid}
            position={[x, y, z]}
            rotation={[
              0,
              entry.rotated ? Math.PI / 2 : 0,
              0,
            ]}
          >
            <FurnitureModel
              item={item}
              W={Math.max(0.05, item.w * tile - margin)}
              D={Math.max(0.05, item.d * tile - margin)}
            />
          </group>
        );
      })}
    </group>
  );
}

function ApartmentShell({
  layout,
  furniture,
}: {
  layout: ApartmentLayout;
  furniture: PlacedFurniture[];
}) {
  const stairs = (layout as LayoutWithStairs).stairs;

  return (
    <group>
      {layout.rooms.map((room, index) => (
        <RoomFloor
          key={`${room.id}-${index}`}
          room={room}
        />
      ))}

      {layout.walls.map((wall) => (
        <ApartmentWallView
          key={wall.id}
          wall={wall}
          openings={layout.openings}
        />
      ))}

      {stairs?.map((stair) => (
        <StairsView key={stair.id} stairs={stair} />
      ))}

      <FurnitureLayer
        layout={layout}
        furniture={furniture}
      />
    </group>
  );
}

function PlayerCharacter({
  layout,
  appearance,
}: {
  layout: ApartmentLayout;
  appearance: CharacterAppearance;
}) {
  const firstRoom = layout.rooms[0];
  if (!firstRoom) return null;

  const x = firstRoom.x + firstRoom.width * 0.25;
  const z = firstRoom.z + firstRoom.depth * 0.8;
  const y = FLOOR_Y + getRoomElevation(firstRoom);

  return (
    <group
      position={[x, y, z]}
      rotation={[0, Math.PI, 0]}
    >
      <CharacterModel
        appearance={appearance}
        targetHeight={1.8}
      />
    </group>
  );
}

export default function Apartment({
  layout,
  furniture = [],
  appearance = DEFAULT_CHARACTER_APPEARANCE,
  controlsEnabled = true,
}: {
  layout: ApartmentLayout;
  furniture?: PlacedFurniture[];
  appearance?: CharacterAppearance;
  controlsEnabled?: boolean;
}) {
  const { target, zoom } = layout.camera;

  const cameraPosition: [number, number, number] = [
    target[0] + 12,
    16,
    target[2] + 14,
  ];

  return (
    <Canvas
      key={layout.id}
      orthographic
      shadows
      dpr={[1, 1.25]}
      camera={{
        position: cameraPosition,
        zoom,
        near: 0.1,
        far: 100,
      }}
      gl={{
        antialias: true,
        alpha: false,
      }}
    >
      <color
        attach="background"
        args={["#e8ded0"]}
      />

      <ambientLight
        intensity={1.1}
        color="#ffe8ce"
      />

      <hemisphereLight
        args={["#fff6e7", "#a0816b", 1.0]}
      />

      <directionalLight
        position={[
          target[0] - 10,
          20,
          target[2] + 12,
        ]}
        intensity={2.2}
        color="#fff0db"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-bias={-0.0001}
      />

      <SoftShadows
        size={25}
        samples={16}
        focus={0.5}
      />

      <ApartmentShell
        layout={layout}
        furniture={furniture}
      />

      <PlayerCharacter
        layout={layout}
        appearance={appearance}
      />

      <OrbitControls
        makeDefault
        enabled={controlsEnabled}
        enableRotate={controlsEnabled}
        enableZoom={controlsEnabled}
        enablePan={false}
        minZoom={zoom * 0.8}
        maxZoom={zoom * 1.2}
        minPolarAngle={0.45}
        maxPolarAngle={1.35}
        target={target}
      />
    </Canvas>
  );
}
