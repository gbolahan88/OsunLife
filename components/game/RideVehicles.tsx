// components/game/RideVehicles.tsx
"use client";

import { Suspense, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import CharacterModel from "@/components/game/CharacterModel";
import type { CharacterAppearance } from "@/store/characterAppearance";
import type { TransportId } from "@/lib/buildingInfo";

export type RideMode = Exclude<TransportId, "trek">;
type Spin = MutableRefObject<number>;
type Vec3 = [number, number, number];

/** Same height the map player uses, so he fits the vehicles. */
const PLAYER_HEIGHT = 30;
/** When seated, the character's feet end up this far below the seat top. Tune if he floats or sinks. */
const SEAT_SHIFT = 8;

function Wheel({ position, radius, width, spin }: { position: Vec3; radius: number; width: number; spin: Spin }) {
  const roll = useRef<THREE.Group>(null);

  // The map player writes the distance driven into `spin`, so wheels turn at the right speed
  useFrame(() => {
    if (roll.current) roll.current.rotation.x = spin.current / radius;
  });

  return (
    <group position={position}>
      <group ref={roll}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[radius, radius, width, 16]} />
          <meshStandardMaterial color="#1b1e20" roughness={0.95} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[radius * 0.55, radius * 0.55, width + 0.5, 12]} />
          <meshStandardMaterial color="#b4bbbd" metalness={0.6} roughness={0.35} />
        </mesh>
        {/* A spoke so the spin is visible */}
        <mesh>
          <boxGeometry args={[width + 0.8, radius * 1.5, radius * 0.22]} />
          <meshStandardMaterial color="#6b7376" metalness={0.5} />
        </mesh>
      </group>
    </group>
  );
}

function Glass() {
  return <meshStandardMaterial color="#a9d8e6" transparent opacity={0.28} roughness={0.12} depthWrite={false} />;
}

function Driver({ position, shirt = "#2c5f7a" }: { position: Vec3; shirt?: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 5.5, 0]} castShadow>
        <capsuleGeometry args={[3.5, 6, 4, 8]} />
        <meshStandardMaterial color={shirt} roughness={0.8} />
      </mesh>
      <mesh position={[0, 13, 0]} castShadow>
        <sphereGeometry args={[3.3, 12, 10]} />
        <meshStandardMaterial color="#6d402d" roughness={0.9} />
      </mesh>
    </group>
  );
}

/** You, seated. `seatTop` is the height of the seat cushion. */
function Passenger({ x, z, seatTop, appearance }: { x: number; z: number; seatTop: number; appearance: CharacterAppearance }) {
  return (
    <group position={[x, seatTop - SEAT_SHIFT, z]}>
      <CharacterModel appearance={appearance} targetHeight={PLAYER_HEIGHT} action="sit" />
    </group>
  );
}

/* ───────────── Okada (motorbike): you are the rider ───────────── */

function OkadaRide({ spin, appearance }: { spin: Spin; appearance: CharacterAppearance }) {
  return (
    <group>
      <Wheel position={[0, 7, 16]} radius={7} width={3.4} spin={spin} />
      <Wheel position={[0, 7, -16]} radius={7} width={3.4} spin={spin} />

      <mesh position={[0, 11, -2]} castShadow>
        <boxGeometry args={[3.4, 3, 28]} />
        <meshStandardMaterial color="#30363a" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Tank */}
      <mesh position={[0, 16, 4]} castShadow>
        <boxGeometry args={[6.6, 5, 11]} />
        <meshStandardMaterial color="#d33a2c" metalness={0.25} roughness={0.4} />
      </mesh>
      {/* Seat */}
      <mesh position={[0, 14, -7]} castShadow>
        <boxGeometry args={[6.2, 2.4, 16]} />
        <meshStandardMaterial color="#202325" roughness={0.9} />
      </mesh>
      {/* Rear fender and tail light */}
      <mesh position={[0, 11.5, -19]}>
        <boxGeometry args={[5, 1.2, 8]} />
        <meshStandardMaterial color="#30363a" />
      </mesh>
      <mesh position={[0, 12.5, -23]}>
        <boxGeometry args={[3, 2, 1]} />
        <meshStandardMaterial color="#df302c" emissive="#a81717" emissiveIntensity={0.5} />
      </mesh>
      {/* Fork, handlebar, headlight */}
      <mesh position={[0, 14, 12.5]} rotation={[-0.4, 0, 0]}>
        <cylinderGeometry args={[0.9, 0.9, 16, 8]} />
        <meshStandardMaterial color="#a7b2b6" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 22, 9]}>
        <boxGeometry args={[18, 1.2, 1.4]} />
        <meshStandardMaterial color="#292e32" metalness={0.5} />
      </mesh>
      <mesh position={[0, 20, 13]}>
        <sphereGeometry args={[2.4, 10, 8]} />
        <meshStandardMaterial color="#fff1bd" emissive="#ffdc88" emissiveIntensity={0.6} />
      </mesh>

      <Passenger x={0} z={-7} seatTop={15.2} appearance={appearance} />
    </group>
  );
}

/* ───────────── Keke (tricycle): open sides, you sit in the back ───────────── */

function KekeRide({ spin, appearance }: { spin: Spin; appearance: CharacterAppearance }) {
  const yellow = "#f2c230";
  const black = "#1c1f21";

  return (
    <group>
      <Wheel position={[0, 6.5, 21]} radius={6.5} width={3} spin={spin} />
      {[-1, 1].map((side) => (
        <Wheel key={side} position={[side * 13.5, 6.5, -13]} radius={6.5} width={3.4} spin={spin} />
      ))}

      {/* Floor */}
      <mesh position={[0, 8, -4]} castShadow>
        <boxGeometry args={[27, 2, 44]} />
        <meshStandardMaterial color={black} roughness={0.8} />
      </mesh>
      {/* Front cowl and windshield */}
      <mesh position={[0, 14, 17]} castShadow>
        <boxGeometry args={[16, 12, 14]} />
        <meshStandardMaterial color={yellow} roughness={0.45} />
      </mesh>
      <mesh position={[0, 24, 12]} rotation={[-0.35, 0, 0]}>
        <boxGeometry args={[18, 14, 0.6]} />
        <Glass />
      </mesh>
      {/* Low side panels */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 13, 12, -12]} castShadow>
          <boxGeometry args={[1.2, 6, 24]} />
          <meshStandardMaterial color={yellow} roughness={0.45} />
        </mesh>
      ))}
      {/* Rear bench */}
      <mesh position={[0, 11.5, -13]}>
        <boxGeometry args={[23, 3, 10]} />
        <meshStandardMaterial color={black} roughness={0.9} />
      </mesh>
      <mesh position={[0, 16, -18.5]}>
        <boxGeometry args={[23, 8, 2]} />
        <meshStandardMaterial color={black} roughness={0.9} />
      </mesh>
      {/* Posts and canopy */}
      {[-1, 1].flatMap((side) =>
        [8, -22].map((z) => (
          <mesh key={`${side}-${z}`} position={[side * 13, 22, z]}>
            <boxGeometry args={[1.2, 28, 1.2]} />
            <meshStandardMaterial color={black} />
          </mesh>
        ))
      )}
      <mesh position={[0, 36.6, -7]} castShadow>
        <boxGeometry args={[31, 1.6, 40]} />
        <meshStandardMaterial color={black} roughness={0.7} />
      </mesh>
      <mesh position={[0, 35.7, -7]}>
        <boxGeometry args={[31.6, 0.8, 40.6]} />
        <meshStandardMaterial color={yellow} roughness={0.5} />
      </mesh>
      {/* Headlight */}
      <mesh position={[0, 14, 24.3]}>
        <sphereGeometry args={[2.2, 10, 8]} />
        <meshStandardMaterial color="#fff1bd" emissive="#ffdc88" emissiveIntensity={0.6} />
      </mesh>

      <Driver position={[0, 13, 8]} shirt="#7a3f2a" />
      <Passenger x={0} z={-13} seatTop={13} appearance={appearance} />
    </group>
  );
}

/* ───────────── Taxi: you sit in the back, seen through the windows ───────────── */

function TaxiRide({ spin, appearance }: { spin: Spin; appearance: CharacterAppearance }) {
  const yellow = "#f0bd36";

  return (
    <group>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <Wheel key={`${sx}-${sz}`} position={[sx * 15.5, 7, sz * 22]} radius={7} width={4} spin={spin} />
        ))
      )}

      {/* Body, hood and boot */}
      <mesh position={[0, 12, 0]} castShadow>
        <boxGeometry args={[32, 9, 70]} />
        <meshStandardMaterial color={yellow} roughness={0.4} metalness={0.15} />
      </mesh>
      <mesh position={[0, 17.5, 24]}>
        <boxGeometry args={[30, 2, 20]} />
        <meshStandardMaterial color={yellow} roughness={0.4} metalness={0.15} />
      </mesh>
      <mesh position={[0, 17.5, -29]}>
        <boxGeometry args={[30, 2, 14]} />
        <meshStandardMaterial color={yellow} roughness={0.4} metalness={0.15} />
      </mesh>

      {/* Glass cabin, pillars, roof, taxi sign */}
      <mesh position={[0, 25, -6]}>
        <boxGeometry args={[29, 15, 38]} />
        <Glass />
      </mesh>
      {[-1, 1].flatMap((side) =>
        [12.8, -24.8].map((z) => (
          <mesh key={`${side}-${z}`} position={[side * 14.5, 25, z]}>
            <boxGeometry args={[1.4, 15, 1.4]} />
            <meshStandardMaterial color={yellow} />
          </mesh>
        ))
      )}
      <mesh position={[0, 33, -6]} castShadow>
        <boxGeometry args={[31, 1.6, 40]} />
        <meshStandardMaterial color={yellow} roughness={0.4} />
      </mesh>
      <mesh position={[0, 35.3, -6]}>
        <boxGeometry args={[8, 3, 4]} />
        <meshStandardMaterial color="#fff0a0" emissive="#f6cf53" emissiveIntensity={0.4} />
      </mesh>

      {/* Lights */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 10, 12, 35.2]}>
            <boxGeometry args={[5, 3, 0.8]} />
            <meshStandardMaterial color="#fff4c6" emissive="#ffe5a0" emissiveIntensity={0.7} />
          </mesh>
          <mesh position={[side * 10, 12, -35.2]}>
            <boxGeometry args={[5, 3, 0.8]} />
            <meshStandardMaterial color="#d8322e" emissive="#a91d1d" emissiveIntensity={0.4} />
          </mesh>
        </group>
      ))}

      <Driver position={[8, 14.3, 2]} />
      <Passenger x={-6} z={-17} seatTop={14.3} appearance={appearance} />
    </group>
  );
}

/* ───────────── Korope (yellow minibus): you sit by the window ───────────── */

function KoropeRide({ spin, appearance }: { spin: Spin; appearance: CharacterAppearance }) {
  const yellow = "#f3c316";

  return (
    <group>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <Wheel key={`${sx}-${sz}`} position={[sx * 16, 7.5, sz * 27]} radius={7.5} width={4.4} spin={spin} />
        ))
      )}

      {/* Lower body with the black stripe */}
      <mesh position={[0, 14, 0]} castShadow>
        <boxGeometry args={[34, 14, 84]} />
        <meshStandardMaterial color={yellow} roughness={0.45} metalness={0.1} />
      </mesh>
      <mesh position={[0, 16, 0]}>
        <boxGeometry args={[34.4, 3, 84.4]} />
        <meshStandardMaterial color="#1c1f21" roughness={0.7} />
      </mesh>

      {/* Glass section, pillars, roof */}
      <mesh position={[0, 29, -3]}>
        <boxGeometry args={[32, 16, 72]} />
        <Glass />
      </mesh>
      {[-1, 1].flatMap((side) =>
        [32, 16, 0, -16, -32].map((z) => (
          <mesh key={`${side}-${z}`} position={[side * 16, 29, z]}>
            <boxGeometry args={[1.4, 16, 1.4]} />
            <meshStandardMaterial color={yellow} />
          </mesh>
        ))
      )}
      <mesh position={[0, 38, -3]} castShadow>
        <boxGeometry args={[34, 2, 76]} />
        <meshStandardMaterial color={yellow} roughness={0.45} />
      </mesh>

      {/* Lights */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 11, 13, 42.3]}>
            <boxGeometry args={[6, 3.2, 0.8]} />
            <meshStandardMaterial color="#fff4c6" emissive="#ffe5a0" emissiveIntensity={0.7} />
          </mesh>
          <mesh position={[side * 11, 13, -42.3]}>
            <boxGeometry args={[5, 3.2, 0.8]} />
            <meshStandardMaterial color="#d8322e" emissive="#a91d1d" emissiveIntensity={0.4} />
          </mesh>
        </group>
      ))}

      <Driver position={[9, 15, 26]} shirt="#3a4650" />
      <Passenger x={-9} z={-4} seatTop={15} appearance={appearance} />
    </group>
  );
}

export function RideVehicle({ mode, appearance, spin }: { mode: RideMode; appearance: CharacterAppearance; spin: Spin }) {
  return (
    <Suspense fallback={null}>
      {mode === "okada" && <OkadaRide spin={spin} appearance={appearance} />}
      {mode === "keke" && <KekeRide spin={spin} appearance={appearance} />}
      {mode === "taxi" && <TaxiRide spin={spin} appearance={appearance} />}
      {mode === "korope" && <KoropeRide spin={spin} appearance={appearance} />}
    </Suspense>
  );
}