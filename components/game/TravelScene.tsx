"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { SkipForward } from "lucide-react";

const TRAFFIC = Array.from({ length: 10 }, (_, index) => ({
  id: index,
  color: ["#d9b333", "#e7e1d4", "#39755c", "#a84232", "#43677a"][index % 5],
  lane: index % 2 === 0 ? -3.2 : 3.2,
  direction: index % 2 === 0 ? 1 : -1,
  speed: 9 + ((index * 7) % 8),
  start: ((index * 37) % 190) - 95,
}));

const SHOP_COLORS = ["#c98956", "#d9c49b", "#c5a17e", "#a9b39a", "#d1b879", "#b58b79"];
const BUILDINGS = Array.from({ length: 18 }, (_, index) => {
  const side = index % 2 === 0 ? -1 : 1;
  const block = Math.floor(index / 2);
  return {
    id: index,
    side,
    z: block * 24 - 96,
    width: 8 + ((index * 3) % 4),
    height: 8 + ((index * 7) % 9),
    color: SHOP_COLORS[index % SHOP_COLORS.length],
  };
});

function TrafficCar({
  color,
  lane,
  direction,
  speed,
  start,
}: (typeof TRAFFIC)[number]) {
  const car = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!car.current) return;
    car.current.position.z += direction * speed * delta;
    if (car.current.position.z > 108) car.current.position.z = -108;
    if (car.current.position.z < -108) car.current.position.z = 108;
  });

  return (
    <group ref={car} position={[lane, 0, start]}>
      <mesh position={[0, 0.62, 0]} castShadow>
        <boxGeometry args={[2.3, 0.9, 4.7]} />
        <meshStandardMaterial color={color} metalness={0.12} roughness={0.46} />
      </mesh>
      <mesh position={[0, 1.28, -0.25]} castShadow>
        <boxGeometry args={[1.85, 0.68, 2.45]} />
        <meshStandardMaterial color="#263940" metalness={0.2} roughness={0.22} />
      </mesh>
      <mesh position={[0, 1.3, 0.99]}>
        <boxGeometry args={[1.55, 0.47, 0.035]} />
        <meshStandardMaterial color="#86aeb7" metalness={0.25} roughness={0.2} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 0.83, 0.68, direction > 0 ? 2.37 : -2.37]}>
            <boxGeometry args={[0.42, 0.18, 0.06]} />
            <meshBasicMaterial color={direction > 0 ? "#fff0c1" : "#df4438"} />
          </mesh>
          {[-1.42, 1.42].map((z) => (
            <mesh key={z} position={[side * 1.13, 0.38, z]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.37, 0.37, 0.19, 16]} />
              <meshStandardMaterial color="#202326" roughness={0.9} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function ShopFront({ building }: { building: (typeof BUILDINGS)[number] }) {
  const { side, z, width, height, color } = building;
  const centerX = side * 21;
  const streetFace = centerX - side * width / 2;
  const wallColor = new THREE.Color(color);
  const upperColor = wallColor.clone().multiplyScalar(0.82);

  return (
    <group>
      <mesh position={[centerX, height / 2, z]} castShadow receiveShadow>
        <boxGeometry args={[width, height, 13]} />
        <meshStandardMaterial color={color} roughness={0.92} />
      </mesh>
      <mesh position={[centerX, height + 0.16, z]} castShadow>
        <boxGeometry args={[width + 0.5, 0.32, 13.5]} />
        <meshStandardMaterial color="#776b5a" roughness={0.95} />
      </mesh>
      {[z - 3.5, z + 3.5].map((windowZ) => (
        <group key={windowZ}>
          <mesh position={[streetFace, Math.min(3.9, height * 0.48), windowZ]}>
            <boxGeometry args={[0.12, 1.65, 2.15]} />
            <meshStandardMaterial color="#436c75" metalness={0.15} roughness={0.25} />
          </mesh>
          <mesh position={[streetFace - side * 0.08, Math.min(3.9, height * 0.48), windowZ]}>
            <boxGeometry args={[0.06, 1.84, 2.34]} />
            <meshStandardMaterial color="#dfd0ad" roughness={0.8} />
          </mesh>
        </group>
      ))}
      <mesh position={[streetFace, 2.1, z]}>
        <boxGeometry args={[0.13, 2.25, 1.35]} />
        <meshStandardMaterial color="#493a2e" roughness={0.9} />
      </mesh>
      <mesh position={[streetFace - side * 0.22, height - 1.35, z]}>
        <boxGeometry args={[0.26, 0.95, 7]} />
        <meshStandardMaterial color={upperColor} roughness={0.7} />
      </mesh>
      <mesh position={[streetFace - side * 0.36, height - 1.35, z]}>
        <boxGeometry args={[0.12, 0.18, 7.3]} />
        <meshStandardMaterial color="#eee0bf" roughness={0.8} />
      </mesh>
      <mesh position={[streetFace - side * 0.45, height + 0.1, z]}>
        <boxGeometry args={[0.16, 0.6, 4.4]} />
        <meshStandardMaterial color={building.id % 3 === 0 ? "#1d594b" : "#a34930"} roughness={0.65} />
      </mesh>
    </group>
  );
}

function PalmTree({ x, z, height }: { x: number; z: number; height: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, height / 2, 0]} rotation={[0, 0, -0.08]} castShadow>
        <cylinderGeometry args={[0.22, 0.36, height, 7]} />
        <meshStandardMaterial color="#75553a" roughness={1} />
      </mesh>
      <mesh position={[0, height, 0]} castShadow>
        <sphereGeometry args={[1.25, 7, 5]} />
        <meshStandardMaterial color="#38764b" roughness={1} />
      </mesh>
      {Array.from({ length: 5 }, (_, index) => (
        <mesh
          key={index}
          position={[Math.cos(index * 1.26) * 0.85, height - 0.18, Math.sin(index * 1.26) * 0.85]}
          rotation={[0.12, index * 1.26, 0.36]}
          castShadow
        >
          <boxGeometry args={[0.28, 0.12, 2.2]} />
          <meshStandardMaterial color={index % 2 ? "#477f43" : "#56894b"} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function RoadDashes() {
  const dashes = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!dashes.current) return;
    dashes.current.position.z += delta * 14;
    if (dashes.current.position.z > 9) dashes.current.position.z = 0;
  });

  return (
    <group ref={dashes}>
      {Array.from({ length: 18 }, (_, index) => (
        <mesh key={index} position={[0, 0.025, -index * 12]}>
          <boxGeometry args={[0.16, 0.025, 5.2]} />
          <meshBasicMaterial color="#f4d36a" />
        </mesh>
      ))}
    </group>
  );
}

function RideInterior({ mode }: { mode: string }) {
  if (mode === "trek") return null;
  if (mode === "okada") {
    return (
      <group position={[0, 0, 8]}>
        <mesh position={[0, 1.45, 0]} rotation={[0.1, 0, 0]}>
          <boxGeometry args={[2.9, 0.14, 0.24]} />
          <meshStandardMaterial color="#272b2c" metalness={0.5} roughness={0.35} />
        </mesh>
        <mesh position={[0, 1.08, 0.08]}>
          <cylinderGeometry args={[0.12, 0.12, 0.72, 10]} />
          <meshStandardMaterial color="#6e7775" metalness={0.65} roughness={0.3} />
        </mesh>
        <mesh position={[0, 1.82, -0.2]}>
          <sphereGeometry args={[0.24, 12, 8]} />
          <meshStandardMaterial color="#fff0bd" emissive="#ffc65b" emissiveIntensity={0.5} />
        </mesh>
      </group>
    );
  }

  const isKeke = mode === "keke";
  const bodyColor = isKeke || mode === "korope" ? "#d7a91f" : "#282e31";
  return (
    <group position={[0, 0, 8]}>
      <mesh position={[0, 1.35, 0]}>
        <boxGeometry args={[isKeke ? 6.8 : 5.8, 0.55, 2.1]} />
        <meshStandardMaterial color={bodyColor} metalness={0.12} roughness={0.48} />
      </mesh>
      <mesh position={[0, 1.68, -0.32]}>
        <boxGeometry args={[isKeke ? 6.8 : 5.8, 0.09, 1.2]} />
        <meshStandardMaterial color="#171b1c" roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.55, 0.55]} rotation={[-0.22, 0, 0]}>
        <torusGeometry args={[0.48, 0.075, 8, 24]} />
        <meshStandardMaterial color="#242829" metalness={0.35} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.98, 1.08]}>
        <boxGeometry args={[isKeke ? 6.8 : 5.8, 0.16, 0.18]} />
        <meshStandardMaterial color={bodyColor} metalness={0.18} roughness={0.46} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 2.9, 2.4, -0.22]}>
          <boxGeometry args={[0.13, 2.5, 0.13]} />
          <meshStandardMaterial color={isKeke ? "#272a28" : bodyColor} />
        </mesh>
      ))}
      {isKeke && (
        <mesh position={[0, 3.65, -0.42]}>
          <boxGeometry args={[6.1, 0.18, 2]} />
          <meshStandardMaterial color="#242727" roughness={0.7} />
        </mesh>
      )}
    </group>
  );
}

function LagosRoad({ mode }: { mode: string }) {
  const isWalking = mode === "trek";
  const cameraPosition: [number, number, number] = isWalking ? [0, 2.7, 12] : [0, 4.1, 13];

  return (
    <>
      <color attach="background" args={["#b9dbe5"]} />
      <fog attach="fog" args={["#b9dbe5", 72, 205]} />
      <ambientLight intensity={1.1} color="#fff4e2" />
      <hemisphereLight args={["#cce8f1", "#8d795b", 1.35]} />
      <directionalLight position={[-30, 45, 18]} intensity={2.2} color="#ffe3b0" castShadow />
      <PerspectiveCamera makeDefault position={cameraPosition} fov={isWalking ? 70 : 66} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.11, 0]} receiveShadow>
        <planeGeometry args={[24, 260]} />
        <meshStandardMaterial color="#353b3c" roughness={0.95} />
      </mesh>
      <RoadDashes />
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[side * 13.2, -0.04, 0]} receiveShadow>
            <planeGeometry args={[2.4, 260]} />
            <meshStandardMaterial color="#a9a08c" roughness={1} />
          </mesh>
          <mesh position={[side * 11.9, 0.12, 0]} receiveShadow>
            <boxGeometry args={[0.22, 0.25, 260]} />
            <meshStandardMaterial color="#e1d5bc" roughness={0.9} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[side * 17, -0.02, 0]}>
            <planeGeometry args={[5, 260]} />
            <meshStandardMaterial color="#887a60" roughness={1} />
          </mesh>
        </group>
      ))}

      {BUILDINGS.map((building) => <ShopFront key={building.id} building={building} />)}
      {Array.from({ length: 9 }, (_, index) => (
        <PalmTree
          key={index}
          x={index % 2 === 0 ? -13.6 : 13.6}
          z={index * 25 - 100}
          height={6 + (index % 3)}
        />
      ))}

      {TRAFFIC.map((car) => <TrafficCar key={car.id} {...car} />)}
      <RideInterior mode={mode} />
    </>
  );
}

export default function TravelScene({
  destinationName,
  modeName,
  progressRef,
  onSkip,
}: {
  destinationName: string;
  modeName: string;
  progressRef: MutableRefObject<number>;
  onSkip: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const mode = modeName.toLowerCase();
  const rideEmoji = mode.includes("trek")
    ? "🚶"
    : mode.includes("okada")
      ? "🏍️"
      : mode.includes("keke")
        ? "🛺"
        : mode.includes("korope")
          ? "🚌"
          : "🚕";

  useEffect(() => {
    const timer = window.setInterval(() => {
      setProgress(Math.min(1, Math.max(0, progressRef.current)));
    }, 150);
    return () => window.clearInterval(timer);
  }, [progressRef]);

  const percent = Math.round(progress * 100);

  return (
    <div className="absolute inset-0 z-[100] overflow-hidden bg-[#b9dbe5]">
      <Canvas shadows dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: "high-performance" }}>
        <LagosRoad mode={mode} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:p-5">
        <div className="pointer-events-auto mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-white/60 bg-[#f7f4e9]/95 text-[#20372f] shadow-[0_12px_36px_rgba(27,41,33,0.25)] backdrop-blur-md">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1d5a48] text-xl text-white">
              {rideEmoji}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#648071]">
                On the road
              </p>
              <p className="truncate text-sm font-black">To {destinationName}</p>
            </div>
            <button
              type="button"
              onClick={onSkip}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-[#1d5a48] px-4 text-xs font-extrabold text-white transition-colors hover:bg-[#174737]"
            >
              <SkipForward size={15} />
              Skip
            </button>
          </div>
          <div className="h-1.5 bg-[#dce4d9]">
            <div
              className="h-full bg-[#e6a93c] transition-[width] duration-150"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="flex items-center justify-between px-4 py-2 text-[10px] font-bold text-[#65776c]">
            <span>{modeName}</span>
            <span>{percent}% of the way</span>
          </div>
        </div>

        <div className="pointer-events-none mx-auto mb-3 rounded-full border border-white/40 bg-[#20372f]/75 px-4 py-2 text-[10px] font-bold tracking-wide text-white shadow-lg backdrop-blur-sm">
          Moving through the city
        </div>
      </div>
    </div>
  );
}
