"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useRef } from "react";
import type { Group, PointLight } from "three";

function Box({
  p,
  s,
  c,
  rough = 0.9,
}: {
  p: [number, number, number];
  s: [number, number, number];
  c: string;
  rough?: number;
}) {
  return (
    <mesh position={p} castShadow receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} roughness={rough} />
    </mesh>
  );
}

function FireBarrel() {
  const light = useRef<PointLight>(null);

  useFrame(({ clock }) => {
    if (!light.current) return;
    const t = clock.elapsedTime;
    light.current.intensity = 14 + Math.sin(t * 11) * 2.5 + Math.sin(t * 17) * 1.5;
  });

  return (
    <group position={[2.4, 0, 1.4]}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.42, 0.42, 1, 16]} />
        <meshStandardMaterial color="#4a4f52" metalness={0.5} roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.02, 0]}>
        <cylinderGeometry args={[0.34, 0.34, 0.08, 12]} />
        <meshStandardMaterial color="#ff9a3c" emissive="#ff7a1a" emissiveIntensity={1.4} />
      </mesh>
      <pointLight ref={light} position={[0, 1.6, 0]} color="#ff9a4a" distance={9} decay={2} />
    </group>
  );
}

function Sleeper() {
  return (
    <group position={[-1.4, 0, 1.2]} rotation={[0, 0.35, 0]}>
      {/* cardboard bed and blanket */}
      <Box p={[0, 0.04, 0]} s={[1.3, 0.08, 2.6]} c="#b8935f" />
      <Box p={[0, 0.2, 0.35]} s={[1.0, 0.24, 1.7]} c="#b24a3d" />
      {/* body */}
      <mesh position={[0, 0.34, -0.4]} castShadow>
        <sphereGeometry args={[0.24, 14, 12]} />
        <meshStandardMaterial color="#70472f" roughness={0.9} />
      </mesh>
      <Box p={[0, 0.16, -0.95]} s={[0.5, 0.14, 0.4]} c="#d8d3c4" />
    </group>
  );
}

function PassingCar({
  color,
  speed,
  start,
  lane,
}: {
  color: string;
  speed: number;
  start: number;
  lane: number;
}) {
  const ref = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const span = 44;
    const x = ((start + clock.elapsedTime * speed) % span) - span / 2;
    ref.current.position.set(x, 8.35, lane);
  });

  return (
    <group ref={ref}>
      <Box p={[0, 0.25, 0]} s={[1.9, 0.5, 0.95]} c={color} rough={0.45} />
      <Box p={[-0.1, 0.62, 0]} s={[1, 0.34, 0.85]} c="#2f3a3f" rough={0.4} />
    </group>
  );
}

function Scene() {
  return (
    <>
      <color attach="background" args={["#1c2a3a"]} />
      <fog attach="fog" args={["#1c2a3a", 22, 60]} />
      <ambientLight intensity={0.55} color="#9db4d4" />
      <directionalLight position={[-8, 16, 10]} intensity={0.7} color="#b8c9e8" castShadow />

      {/* ground under the bridge and the river behind it */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 2]} receiveShadow>
        <planeGeometry args={[60, 24]} />
        <meshStandardMaterial color="#6b6a62" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, -14]}>
        <planeGeometry args={[60, 14]} />
        <meshStandardMaterial color="#2a5d73" roughness={0.3} metalness={0.1} />
      </mesh>

      {/* bridge deck */}
      <Box p={[0, 7.6, 0]} s={[40, 1.2, 9]} c="#8f887a" />
      <Box p={[0, 8.45, -4.2]} s={[40, 0.9, 0.5]} c="#b9b19c" />
      <Box p={[0, 8.45, 4.2]} s={[40, 0.9, 0.5]} c="#b9b19c" />
      <Box p={[0, 8.22, 0]} s={[40, 0.05, 8]} c="#3f4446" />
      <Box p={[0, 8.26, 0]} s={[40, 0.03, 0.12]} c="#e0b94f" />

      {/* pillars and cross beams */}
      {[-10, 10].map((x) =>
        [-3, 3].map((z) => <Box key={`${x}${z}`} p={[x, 3.5, z]} s={[1.3, 7, 1.3]} c="#a29a88" />)
      )}
      {[-10, 10].map((x) => (
        <Box key={x} p={[x, 6.8, 0]} s={[1.6, 0.6, 8]} c="#8f887a" />
      ))}

      {/* camp */}
      <Sleeper />
      <FireBarrel />
      <Box p={[0.7, 0.3, 2.6]} s={[0.7, 0.6, 0.5]} c="#7a8f9c" />
      <Box p={[-3.6, 0.25, 2.2]} s={[0.6, 0.5, 0.6]} c="#a07c52" />

      {/* traffic overhead */}
      <PassingCar color="#d94e3f" speed={4} start={5} lane={-1.4} />
      <PassingCar color="#f0bd36" speed={3} start={28} lane={1.4} />
      <PassingCar color="#e9e6dc" speed={5} start={18} lane={-1.4} />

      <OrbitControls
        enablePan={false}
        minDistance={9}
        maxDistance={22}
        minPolarAngle={0.9}
        maxPolarAngle={1.45}
        minAzimuthAngle={-0.9}
        maxAzimuthAngle={0.9}
        target={[0, 2.5, 0]}
      />
    </>
  );
}

export default function BridgeShelter() {
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [5, 4.5, 15], fov: 45, near: 0.1, far: 120 }}
      gl={{ antialias: true, alpha: false }}
    >
      <Scene />
    </Canvas>
  );
}