// components/game/ZeusClub.tsx
"use client";

import { Suspense, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import CharacterModel from "@/components/game/CharacterModel";
import { DEFAULT_CHARACTER_APPEARANCE } from "@/store/characterAppearance";

export type ObstacleBox = { x: number; z: number; hw: number; hd: number };

/** Solid things the club draws itself, so players can't walk through them. */
export const CLUB_BOXES: ObstacleBox[] = [
  { x: 0, z: -6, hw: 3.1, hd: 1.1 },   // DJ table
  { x: -4, z: -7, hw: 0.8, hd: 0.8 },  // speaker
  { x: 4, z: -7, hw: 0.8, hd: 0.8 },   // speaker
  { x: -8, z: -2, hw: 2.4, hd: 2.4 },  // bar
  { x: 8, z: 2, hw: 2, hd: 2 },        // VIP sofa
];

const STAFF_HEIGHT = 2;

const CROWD = [
  { x: 0, z: 2, color: "#d6a23d", rot: 0 },
  { x: -2, z: 1, color: "#b84d3d", rot: Math.PI / 4 },
  { x: 2, z: 1, color: "#3c8273", rot: -Math.PI / 4 },
  { x: -3, z: 4, color: "#496a9a", rot: Math.PI / 2 },
  { x: 3, z: 4, color: "#853c6c", rot: -Math.PI / 2 },
  { x: 0, z: 5, color: "#eee0bd", rot: Math.PI },
  { x: -5, z: 0, color: "#d6a23d", rot: Math.PI / 3 },
  { x: 5, z: 0, color: "#b84d3d", rot: -Math.PI / 3 },
];

/** Bright, moving party lights. Lower the ambient / hemisphere numbers for a moodier club. */
export function ClubLights() {
  const lights = useRef<(THREE.PointLight | null)[]>([]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    lights.current.forEach((light, index) => {
      if (!light) return;
      const a = t * (0.5 + index * 0.15) + index * 2.1;
      light.position.set(Math.cos(a) * 7, 4.5, 2 + Math.sin(a * 1.3) * 4);
      light.color.setHSL((t * 0.08 + index / 3) % 1, 0.9, 0.55);
    });
  });

  return (
    <>
      <ambientLight intensity={1.15} color="#b9b2e8" />
      <hemisphereLight args={["#c7b8ff", "#2a1a45", 0.9]} />
      <directionalLight position={[0, 14, 14]} intensity={1.1} color="#ffffff" />
      <spotLight position={[0, 12, 2]} angle={0.95} penumbra={0.7} intensity={26} color="#ffe9c4" />
      {[0, 1, 2].map((index) => (
        <pointLight
          key={index}
          ref={(light) => {
            lights.current[index] = light;
          }}
          intensity={22}
          distance={20}
          decay={1.4}
        />
      ))}
    </>
  );
}

const FLOOR_COLS = 9;
const FLOOR_ROWS = 6;
const TILE = 1.5;

/** Glowing, colour-cycling dance floor tiles. */
export function DanceFloor() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useLayoutEffect(() => {
    const instanced = mesh.current;
    if (!instanced) return;
    let index = 0;
    for (let row = 0; row < FLOOR_ROWS; row += 1) {
      for (let col = 0; col < FLOOR_COLS; col += 1) {
        dummy.position.set(
          (col - (FLOOR_COLS - 1) / 2) * TILE,
          0.03,
          2 + (row - (FLOOR_ROWS - 1) / 2) * TILE,
        );
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.scale.setScalar(0.94);
        dummy.updateMatrix();
        instanced.setMatrixAt(index, dummy.matrix);
        index += 1;
      }
    }
    instanced.instanceMatrix.needsUpdate = true;
  }, [dummy]);

  useFrame(({ clock }) => {
    const instanced = mesh.current;
    if (!instanced) return;
    const t = clock.elapsedTime;
    let index = 0;
    for (let row = 0; row < FLOOR_ROWS; row += 1) {
      for (let col = 0; col < FLOOR_COLS; col += 1) {
        const hue = (t * 0.12 + (row + col) * 0.06) % 1;
        const lightness = 0.26 + 0.14 * Math.sin(t * 3 + row * 1.3 + col * 0.9);
        color.setHSL(hue, 0.85, lightness);
        instanced.setColorAt(index, color);
        index += 1;
      }
    }
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, FLOOR_COLS * FLOOR_ROWS]} frustumCulled={false}>
      <planeGeometry args={[TILE, TILE]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

function StaffTag({ label }: { label: string }) {
  return (
    <Html position={[0, STAFF_HEIGHT + 0.5, 0]} center zIndexRange={[90, 0]}>
      <span className="pointer-events-none whitespace-nowrap rounded-full bg-[#ff2d8f]/90 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white shadow">
        {label}
      </span>
    </Html>
  );
}

export function ZeusClubProps() {
  return <>
    {/* Neon strips so the walls glow */}
    <mesh position={[0, 4.5, -7.95]}>
      <boxGeometry args={[21, 0.12, 0.12]} />
      <meshStandardMaterial color="#ff2d8f" emissive="#ff2d8f" emissiveIntensity={3} />
    </mesh>
    {[-11.1, 11.1].map((x) => (
      <mesh key={x} position={[x, 4.5, 0]}>
        <boxGeometry args={[0.12, 0.12, 15]} />
        <meshStandardMaterial color="#35d9ff" emissive="#35d9ff" emissiveIntensity={3} />
      </mesh>
    ))}

    {/* DJ booth and LED screens */}
    <group position={[0, 0, -6]}>
      <mesh position={[0, 4, -2]}>
        <boxGeometry args={[10, 4, 0.2]} />
        <meshStandardMaterial color="#8de2e8" emissive="#35d9ff" emissiveIntensity={0.9} />
      </mesh>
      <mesh position={[3, 1.6, -1.9]}>
        <boxGeometry args={[3.5, 1.6, 0.2]} />
        <meshStandardMaterial color="#c9a4ff" emissive="#8b5cf6" emissiveIntensity={1} />
      </mesh>
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[6, 1.5, 2]} />
        <meshStandardMaterial color="#1a1a28" />
      </mesh>
      <mesh position={[0, 2.3, 0]}>
        <boxGeometry args={[6.2, 0.1, 2.2]} />
        <meshStandardMaterial color="#ff007f" emissive="#ff007f" emissiveIntensity={2} />
      </mesh>
      {[-4, 4].map((x) => (
        <group key={x} position={[x, 2, -1]}>
          <mesh><boxGeometry args={[1.5, 4, 1.5]} /><meshStandardMaterial color="#26263c" /></mesh>
          {[-1, 0, 1].map((y) => (
            <mesh key={y} position={[0, y, 0.8]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.4, 0.4, 0.1, 16]} />
              <meshStandardMaterial color="#222" emissive="#8b5cf6" emissiveIntensity={1} />
            </mesh>
          ))}
        </group>
      ))}
    </group>

    {/* The bar */}
    <group position={[-8, 0, -2]} rotation={[0, Math.PI / 4, 0]}>
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[5, 2.5, 1.5]} />
        <meshStandardMaterial color="#26263c" />
      </mesh>
      <mesh position={[0, 2.8, 0]}>
        <boxGeometry args={[5.2, 0.1, 1.7]} />
        <meshStandardMaterial color="#ff007f" emissive="#ff007f" emissiveIntensity={3} />
      </mesh>
      <mesh position={[0, 3, -1]}>
        <boxGeometry args={[5, 4, 0.2]} />
        <meshStandardMaterial color="#12121c" />
      </mesh>
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh key={i} position={[-2 + i * 0.6, 3.5, -0.8]}>
          <cylinderGeometry args={[0.08, 0.08, 0.5]} />
          <meshStandardMaterial color={["#ff007f", "#00f0ff", "#ffd700"][i % 3]} emissive={["#ff007f", "#00f0ff", "#ffd700"][i % 3]} emissiveIntensity={1.5} />
        </mesh>
      ))}
    </group>

    {/* Red VIP sofa */}
    <group position={[8, 0, 2]} rotation={[0, -Math.PI / 4, 0]}>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[4, 1, 1.5]} />
        <meshStandardMaterial color="#a50d12" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.5, -0.6]}>
        <boxGeometry args={[4, 1.5, 0.3]} />
        <meshStandardMaterial color="#a50d12" roughness={0.9} />
      </mesh>
    </group>

    <Suspense fallback={null}>
      {/* DJ behind the booth */}
      <group position={[0, 0, -7.3]}>
        <CharacterModel
          appearance={{ ...DEFAULT_CHARACTER_APPEARANCE, shirt: "#1f2430" }}
          targetHeight={STAFF_HEIGHT}
          action="dance"
        />
        <StaffTag label="DJ" />
      </group>

      {/* Hype Man */}
      <group position={[2.8, 0, -4.2]}>
        <CharacterModel
          appearance={{ ...DEFAULT_CHARACTER_APPEARANCE, shirt: "#f0b43a", trousers: "#1f2430" }}
          targetHeight={STAFF_HEIGHT}
          action="dance"
        />
        <StaffTag label="Hype Man" />
      </group>

      {/* Bartender behind the bar, facing the room */}
      <group position={[-8.85, 0, -2.85]} rotation={[0, Math.PI / 4, 0]}>
        <CharacterModel
          appearance={{ ...DEFAULT_CHARACTER_APPEARANCE, shirt: "#f4efe6", trousers: "#1f2430" }}
          targetHeight={STAFF_HEIGHT}
          action="work"
        />
        <StaffTag label="Bartender" />
      </group>

      {/* The dancing crowd */}
      {CROWD.map((bot, index) => (
        <group key={index} position={[bot.x, 0, bot.z]} rotation={[0, bot.rot, 0]}>
          <CharacterModel
            appearance={{ ...DEFAULT_CHARACTER_APPEARANCE, shirt: bot.color }}
            targetHeight={STAFF_HEIGHT}
            action="dance"
          />
        </group>
      ))}
    </Suspense>
  </>;
}