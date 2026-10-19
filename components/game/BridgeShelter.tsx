
"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useRef } from "react";
import type { Group, Mesh, PointLight } from "three";
import * as THREE from "three";
import { useNow } from "@/hooks/useNow";
import { useGameStore } from "@/store/gameStore";
import { getGameClock } from "@/lib/time";

type Vec3 = [number, number, number];

function Box({
  p,
  s,
  c,
  rough = 0.9,
  metalness = 0,
}: {
  p: Vec3;
  s: Vec3;
  c: string;
  rough?: number;
  metalness?: number;
}) {
  return (
    <mesh position={p} castShadow receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial
        color={c}
        roughness={rough}
        metalness={metalness}
      />
    </mesh>
  );
}

function Cylinder({
  p,
  r,
  h,
  c,
  rotation = [0, 0, 0],
}: {
  p: Vec3;
  r: number;
  h: number;
  c: string;
  rotation?: Vec3;
}) {
  return (
    <mesh position={p} rotation={rotation} castShadow receiveShadow>
      <cylinderGeometry args={[r, r, h, 12]} />
      <meshStandardMaterial color={c} roughness={0.85} />
    </mesh>
  );
}

function RoadRing() {
  return (
    <group position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      {/* Main circular asphalt road */}
      <mesh receiveShadow>
        <ringGeometry args={[5.0, 8.2, 128]} />
        <meshStandardMaterial color="#303336" roughness={0.96} />
      </mesh>

      {/* Outer and inner road borders */}
      <mesh position={[0, 0, 0.006]}>
        <ringGeometry args={[8.05, 8.17, 128]} />
        <meshStandardMaterial color="#e4dfcf" roughness={0.9} />
      </mesh>

      <mesh position={[0, 0, 0.008]}>
        <ringGeometry args={[5.0, 5.12, 128]} />
        <meshStandardMaterial color="#e4dfcf" roughness={0.9} />
      </mesh>

      {/* Broken lane markings */}
      {Array.from({ length: 48 }, (_, i) => {
        const a = (i / 48) * Math.PI * 2;
        const r = 6.55;

        return (
          <mesh
            key={i}
            position={[Math.cos(a) * r, Math.sin(a) * r, 0.014]}
            rotation={[0, 0, a]}
          >
            <planeGeometry args={[0.25, 0.055]} />
            <meshStandardMaterial
              color="#f0dca0"
              roughness={0.8}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function StraightRoads() {
  return (
    <>
      {/* Two straight traffic lanes crossing the scene */}
      {[-10, 10].map((z) => (
        <group key={z}>
          <Box
            p={[0, 0.025, z]}
            s={[60, 0.045, 4.2]}
            c="#303336"
          />

          <Box
            p={[0, 0.051, z]}
            s={[60, 0.012, 0.055]}
            c="#d8c68a"
          />

          {/* Dashed lane markings */}
          {Array.from({ length: 18 }, (_, i) => (
            <Box
              key={i}
              p={[-27 + i * 3.2, 0.055, z]}
              s={[1.35, 0.012, 0.055]}
              c="#e6e0c8"
            />
          ))}
        </group>
      ))}
    </>
  );
}

function Firewood() {
  const flame1 = useRef<Mesh>(null);
  const flame2 = useRef<Mesh>(null);
  const light = useRef<PointLight>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    if (flame1.current) {
      flame1.current.scale.set(
        0.8 + Math.sin(t * 13) * 0.16,
        0.85 + Math.sin(t * 10) * 0.25,
        0.8 + Math.cos(t * 12) * 0.15
      );
      flame1.current.rotation.z = Math.sin(t * 8) * 0.12;
    }

    if (flame2.current) {
      flame2.current.scale.set(
        0.75 + Math.sin(t * 15) * 0.2,
        0.85 + Math.cos(t * 12) * 0.25,
        0.8 + Math.sin(t * 9) * 0.2
      );
      flame2.current.rotation.z = Math.cos(t * 7) * 0.15;
    }

    if (light.current) {
      light.current.intensity =
        4.5 + Math.sin(t * 12) * 1.2 + Math.sin(t * 19) * 0.65;
    }
  });

  return (
    <group position={[0.9, 0.1, 0.6]}>
      {/* Ash and stones */}
      <Cylinder
        p={[0, 0.025, 0]}
        r={0.72}
        h={0.06}
        c="#36312c"
      />

      {Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI * 2;

        return (
          <mesh
            key={i}
            position={[
              Math.cos(a) * 0.62,
              0.07,
              Math.sin(a) * 0.62,
            ]}
            castShadow
          >
            <dodecahedronGeometry args={[0.12, 0]} />
            <meshStandardMaterial color="#65605a" roughness={1} />
          </mesh>
        );
      })}

      {/* Burning logs */}
      <Cylinder
        p={[0, 0.15, 0]}
        r={0.085}
        h={0.85}
        c="#493024"
        rotation={[0, 0, Math.PI / 2]}
      />

      <Cylinder
        p={[0, 0.19, 0]}
        r={0.075}
        h={0.75}
        c="#63402a"
        rotation={[0.12, 0.8, Math.PI / 2]}
      />

      <Cylinder
        p={[0, 0.22, 0]}
        r={0.065}
        h={0.62}
        c="#33251e"
        rotation={[0.1, -0.8, Math.PI / 2]}
      />

      {/* Animated flames */}
      <mesh
        ref={flame1}
        position={[0, 0.48, 0]}
        castShadow
      >
        <coneGeometry args={[0.25, 0.8, 9]} />
        <meshStandardMaterial
          color="#ff6a12"
          emissive="#ff4b08"
          emissiveIntensity={2}
          roughness={0.35}
        />
      </mesh>

      <mesh
        ref={flame2}
        position={[0.1, 0.4, 0.08]}
        castShadow
      >
        <coneGeometry args={[0.17, 0.58, 8]} />
        <meshStandardMaterial
          color="#ffcf42"
          emissive="#ff8a08"
          emissiveIntensity={2.4}
          roughness={0.3}
        />
      </mesh>

      <mesh position={[-0.1, 0.3, -0.08]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial
          color="#ffb52b"
          emissive="#ff5b00"
          emissiveIntensity={2}
        />
      </mesh>

      <pointLight
        ref={light}
        position={[0, 1.1, 0]}
        color="#ff8a36"
        intensity={4.5}
        distance={8}
        decay={2}
        castShadow
      />
    </group>
  );
}

function Tent() {
  return (
    <group position={[-1.5, 0, -1.1]} rotation={[0, -0.2, 0]}>
      {/* Ground mat */}
      <Box
        p={[0, 0.065, 0.1]}
        s={[2.4, 0.08, 2.5]}
        c="#756044"
      />

      {/* Tent fabric: two sloping sides */}
      <mesh
        position={[0, 0.95, -0.15]}
        rotation={[0, 0, Math.PI / 4]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[1.85, 0.065, 2.15]} />
        <meshStandardMaterial
          color="#53674a"
          roughness={1}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh
        position={[0, 0.95, -0.15]}
        rotation={[0, 0, -Math.PI / 4]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[1.85, 0.065, 2.15]} />
        <meshStandardMaterial
          color="#364d38"
          roughness={1}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Tent ridge pole */}
      <Cylinder
        p={[0, 1.58, -0.15]}
        r={0.035}
        h={2.35}
        c="#6e5336"
        rotation={[Math.PI / 2, 0, 0]}
      />

      {/* Entrance support poles */}
      {[-0.92, 0.92].map((x) => (
        <Cylinder
          key={x}
          p={[x, 0.73, 0.93]}
          r={0.035}
          h={1.45}
          c="#76583a"
        />
      ))}

      {/* Bedding visible at the entrance */}
      <Box
        p={[0, 0.18, 0.95]}
        s={[1.05, 0.15, 0.8]}
        c="#8d4940"
      />

      <Box
        p={[0, 0.27, 1.15]}
        s={[0.55, 0.12, 0.25]}
        c="#d0bba0"
      />
    </group>
  );
}

function SleepingArea() {
  return (
    <group position={[-3.2, 0, 1.7]} rotation={[0, 0.35, 0]}>
      <Box
        p={[0, 0.06, 0]}
        s={[1.2, 0.1, 2.0]}
        c="#8b765b"
      />

      <Box
        p={[0, 0.18, 0.15]}
        s={[0.95, 0.18, 1.3]}
        c="#9b493f"
      />

      {/* Pillow */}
      <Box
        p={[0, 0.3, 0.78]}
        s={[0.55, 0.15, 0.34]}
        c="#d3c8ae"
      />

      {/* Rolled blanket */}
      <mesh position={[0.32, 0.23, -0.55]} castShadow>
        <cylinderGeometry args={[0.13, 0.13, 0.8, 10]} />
        <meshStandardMaterial color="#52614b" roughness={1} />
      </mesh>
    </group>
  );
}

function ShelterProps() {
  return (
    <>
      <Tent />
      <SleepingArea />
      <Firewood />

      {/* Storage boxes and belongings */}
      <Box
        p={[2.25, 0.22, -1.8]}
        s={[0.55, 0.45, 0.55]}
        c="#85613e"
      />

      <Box
        p={[2.5, 0.13, -1.05]}
        s={[0.42, 0.25, 0.38]}
        c="#526b77"
      />

      <Box
        p={[-3.3, 0.17, -1.0]}
        s={[0.45, 0.32, 0.45]}
        c="#ae9061"
      />

      {/* Water container */}
      <mesh position={[2.8, 0.3, 0.1]} castShadow>
        <cylinderGeometry args={[0.22, 0.2, 0.55, 12]} />
        <meshStandardMaterial color="#52778c" roughness={0.65} />
      </mesh>

      {/* Wooden crate */}
      <Box
        p={[-2.9, 0.2, 2.5]}
        s={[0.65, 0.4, 0.55]}
        c="#79573a"
      />

      {/* Small stool */}
      <Box
        p={[1.9, 0.23, 2.15]}
        s={[0.65, 0.12, 0.55]}
        c="#75583c"
      />

      <Box
        p={[1.9, 0.1, 2.15]}
        s={[0.12, 0.2, 0.12]}
        c="#59412e"
      />
    </>
  );
}

function Vehicle({
  color,
  type = "car",
}: {
  color: string;
  type?: "car" | "van" | "taxi";
}) {
  const length = type === "van" ? 2.1 : 1.7;
  const height = type === "van" ? 0.66 : 0.45;

  return (
    <group>
      {/* Main chassis */}
      <Box
        p={[0, 0.25, 0]}
        s={[length, 0.4, 0.88]}
        c={color}
        rough={0.45}
        metalness={0.12}
      />

      {/* Cabin */}
      <Box
        p={[-0.12, type === "van" ? 0.68 : 0.58, 0]}
        s={[
          type === "van" ? 1.05 : 0.95,
          height,
          0.72,
        ]}
        c="#303d43"
        rough={0.35}
      />

      {/* Windscreen */}
      <Box
        p={[length * 0.31, 0.55, 0]}
        s={[0.045, 0.3, 0.65]}
        c="#a8c6d3"
        rough={0.25}
      />

      {/* Taxi roof sign */}
      {type === "taxi" && (
        <Box
          p={[-0.1, 0.89, 0]}
          s={[0.38, 0.12, 0.3]}
          c="#f8e0a0"
        />
      )}

      {/* Wheels */}
      {[-0.56, 0.56].map((x) =>
        [-0.47, 0.47].map((z) => (
          <mesh
            key={`${x}-${z}`}
            position={[x, 0.12, z]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <cylinderGeometry args={[0.18, 0.18, 0.12, 12]} />
            <meshStandardMaterial color="#17191a" roughness={1} />
          </mesh>
        ))
      )}

      {/* Headlights */}
      {[-0.28, 0.28].map((z) => (
        <mesh key={z} position={[length / 2 + 0.012, 0.29, z]}>
          <boxGeometry args={[0.035, 0.1, 0.15]} />
          <meshStandardMaterial
            color="#fff0bd"
            emissive="#ffd77a"
            emissiveIntensity={2}
          />
        </mesh>
      ))}

      {/* Rear lights */}
      {[-0.28, 0.28].map((z) => (
        <mesh key={z} position={[-length / 2 - 0.012, 0.29, z]}>
          <boxGeometry args={[0.035, 0.1, 0.13]} />
          <meshStandardMaterial
            color="#fa3434"
            emissive="#c70000"
            emissiveIntensity={1.5}
          />
        </mesh>
      ))}
    </group>
  );
}

function RoundaboutTraffic({
  color,
  type,
  startAngle,
  speed,
  radius,
}: {
  color: string;
  type: "car" | "van" | "taxi";
  startAngle: number;
  speed: number;
  radius: number;
}) {
  const ref = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;

    const angle = startAngle + clock.elapsedTime * speed;

    ref.current.position.set(
      Math.cos(angle) * radius,
      0.07,
      Math.sin(angle) * radius
    );

    // Vehicle's long axis is local X.
    ref.current.rotation.y = -angle - Math.PI / 2;
  });

  return (
    <group ref={ref}>
      <Vehicle color={color} type={type} />
    </group>
  );
}

function StraightTraffic({
  color,
  type,
  start,
  speed,
  lane,
}: {
  color: string;
  type: "car" | "van" | "taxi";
  start: number;
  speed: number;
  lane: number;
}) {
  const ref = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;

    const span = 58;
    const x = ((start + clock.elapsedTime * speed) % span) - span / 2;

    ref.current.position.set(x, 0.07, lane);

    // Opposing lanes face opposite directions.
    ref.current.rotation.y = lane > 0 ? Math.PI : 0;
  });

  return (
    <group ref={ref}>
      <Vehicle color={color} type={type} />
    </group>
  );
}

function Motorcycle() {
  return (
    <group>
      {/* Two wheels */}
      {[-0.42, 0.42].map((z) => (
        <mesh
          key={z}
          position={[0, 0.18, z]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <torusGeometry args={[0.17, 0.055, 8, 14]} />
          <meshStandardMaterial color="#181a1c" roughness={0.9} />
        </mesh>
      ))}

      {/* Frame and body */}
      <Box
        p={[0, 0.38, 0]}
        s={[0.22, 0.16, 0.56]}
        c="#c53a2e"
        rough={0.5}
      />

      <Box
        p={[0, 0.53, -0.06]}
        s={[0.25, 0.12, 0.32]}
        c="#25282a"
      />

      {/* Handlebar */}
      <Cylinder
        p={[0, 0.58, 0.37]}
        r={0.025}
        h={0.4}
        c="#55585a"
        rotation={[0, 0, Math.PI / 2]}
      />

      {/* Rider body */}
      <mesh position={[0, 0.78, -0.02]} castShadow>
        <capsuleGeometry args={[0.12, 0.28, 4, 8]} />
        <meshStandardMaterial color="#345e89" roughness={0.9} />
      </mesh>

      {/* Rider helmet */}
      <mesh position={[0, 1.03, 0.08]} castShadow>
        <sphereGeometry args={[0.13, 12, 10]} />
        <meshStandardMaterial color="#e5c44d" roughness={0.5} />
      </mesh>

      {/* Headlight */}
      <mesh position={[0, 0.43, 0.46]}>
        <sphereGeometry args={[0.07, 10, 8]} />
        <meshStandardMaterial
          color="#fff1b9"
          emissive="#ffcf72"
          emissiveIntensity={2}
        />
      </mesh>
    </group>
  );
}

function RoundaboutBike({
  startAngle,
  speed,
  radius,
}: {
  startAngle: number;
  speed: number;
  radius: number;
}) {
  const ref = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;

    const angle = startAngle + clock.elapsedTime * speed;

    ref.current.position.set(
      Math.cos(angle) * radius,
      0.07,
      Math.sin(angle) * radius
    );

    ref.current.rotation.y = -angle - Math.PI / 2;
  });

  return (
    <group ref={ref} scale={0.8}>
      <Motorcycle />
    </group>
  );
}

function StraightBike({
  start,
  speed,
  lane,
}: {
  start: number;
  speed: number;
  lane: number;
}) {
  const ref = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;

    const span = 58;
    const x = ((start + clock.elapsedTime * speed) % span) - span / 2;

    ref.current.position.set(x, 0.07, lane);
    ref.current.rotation.y = lane > 0 ? Math.PI : 0;
  });

  return (
    <group ref={ref} scale={0.8}>
      <Motorcycle />
    </group>
  );
}

function BridgeStructure() {
  return (
    <>
      {/* Heavy concrete bridge deck */}
      <Box
        p={[0, 7.4, 0]}
        s={[44, 1.2, 27]}
        c="#77756e"
      />

      {/* Road surface on top */}
      <Box
        p={[0, 8.04, 0]}
        s={[44, 0.08, 24]}
        c="#34383b"
      />

      {/* Top bridge lane markings */}
      {Array.from({ length: 14 }, (_, i) => (
        <Box
          key={i}
          p={[-20 + i * 3.1, 8.095, 0]}
          s={[1.3, 0.015, 0.1]}
          c="#d8cba5"
        />
      ))}

      {/* Outer concrete edges */}
      {[-12.3, 12.3].map((z) => (
        <Box
          key={z}
          p={[0, 8.25, z]}
          s={[44, 0.42, 0.4]}
          c="#aaa397"
        />
      ))}

      {/* Main bridge girders */}
      {[-10, -3.5, 3.5, 10].map((z) => (
        <Box
          key={z}
          p={[0, 6.65, z]}
          s={[44, 0.42, 0.75]}
          c="#686760"
        />
      ))}

      {/* Bridge support pillars */}
      {[-15, 15].map((x) =>
        [-8, 8].map((z) => (
          <group key={`${x}-${z}`}>
            <Box
              p={[x, 3.3, z]}
              s={[1.65, 6.6, 1.65]}
              c="#858178"
            />

            <Box
              p={[x, 0.28, z]}
              s={[2.05, 0.55, 2.05]}
              c="#716e67"
            />

            <Box
              p={[x, 6.45, z]}
              s={[2.2, 0.5, 2.2]}
              c="#918b7f"
            />
          </group>
        ))
      )}

      {/* Additional crossbeams */}
      {[-15, 15].map((x) => (
        <Box
          key={x}
          p={[x, 6.85, 0]}
          s={[1.9, 0.55, 24]}
          c="#77746c"
        />
      ))}

      {/* Warm lights underneath the bridge */}
      {[-12, 0, 12].map((x) =>
        [-5, 5].map((z) => (
          <group key={`${x}-${z}`}>
            <mesh position={[x, 6.78, z]}>
              <boxGeometry args={[0.65, 0.09, 0.35]} />
              <meshStandardMaterial
                color="#e4c28a"
                emissive="#ffad45"
                emissiveIntensity={1.3}
              />
            </mesh>

            <pointLight
              position={[x, 6.45, z]}
              color="#ffb86b"
              intensity={1.2}
              distance={8}
              decay={2}
            />
          </group>
        ))
      )}
    </>
  );
}


function Scene() {
  const now = useNow(1000);
  const devOffsetMs = useGameStore((state) => state.devOffsetMs);

  const gameClock = getGameClock(now + devOffsetMs);
  const hour = gameClock.hour;

  // Daylight begins at 7 AM and night begins at 7 PM.
  // Blend lighting smoothly during the hour before each transition.
  const smoothstep = (edge0: number, edge1: number, value: number) => {
    const t = THREE.MathUtils.clamp(
      (value - edge0) / (edge1 - edge0),
      0,
      1
    );
    return t * t * (3 - 2 * t);
  };

  const daylight = smoothstep(6, 7, hour) *
    (1 - smoothstep(19, 20, hour));

  const night = 1 - daylight;

  const skyColor = new THREE.Color("#17212a").lerp(
    new THREE.Color("#a8cbe8"),
    daylight
  );

  const fogColor = new THREE.Color("#17212a").lerp(
    new THREE.Color("#a8cbe8"),
    daylight
  );

  return (
    <>
      <color attach="background" args={[skyColor]} />

      <fog
        attach="fog"
        args={[fogColor, 32, 75]}
      />

      <ambientLight
        intensity={0.15 + daylight * 0.65}
        color={night ? "#9aaccb" : "#ffffff"}
      />

      <directionalLight
        position={[-10, 18, 8]}
        intensity={0.15 + daylight * 0.95}
        color={night ? "#9caed0" : "#fff0cf"}
        castShadow
      />

      {/* Ground */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.09, 0]}
        receiveShadow
      >
        <planeGeometry args={[80, 55]} />
        <meshStandardMaterial
          color={daylight > 0.5 ? "#77766a" : "#353a40"}
          roughness={1}
        />
      </mesh>

      <StraightRoads />
      <RoadRing />
      <ShelterProps />
      <BridgeStructure />

      {/* Roundabout cars */}
      <RoundaboutTraffic
        color="#d74636"
        type="car"
        startAngle={0}
        speed={0.35}
        radius={6.05}
      />

      <RoundaboutTraffic
        color="#e5bb36"
        type="taxi"
        startAngle={2}
        speed={0.31}
        radius={6.8}
      />

      <RoundaboutTraffic
        color="#e8e6df"
        type="car"
        startAngle={4.1}
        speed={0.38}
        radius={7.55}
      />

      <RoundaboutTraffic
        color="#437fb5"
        type="van"
        startAngle={5.2}
        speed={0.27}
        radius={6.1}
      />

      <RoundaboutBike
        startAngle={1}
        speed={0.52}
        radius={7.1}
      />

      <RoundaboutBike
        startAngle={3.2}
        speed={0.47}
        radius={5.65}
      />

      {/* Straight traffic along the X-axis */}
      <StraightTraffic
        color="#d94e3f"
        type="car"
        start={4}
        speed={5}
        lane={-10}
      />

      <StraightTraffic
        color="#eee9de"
        type="van"
        start={24}
        speed={4}
        lane={-10}
      />

      <StraightTraffic
        color="#d8b92e"
        type="taxi"
        start={40}
        speed={6}
        lane={-10}
      />

      <StraightTraffic
        color="#427db0"
        type="van"
        start={16}
        speed={-4.5}
        lane={10}
      />

      <StraightTraffic
        color="#dedbd4"
        type="car"
        start={38}
        speed={-5.5}
        lane={10}
      />

      <StraightBike start={30} speed={5} lane={-10} />
      <StraightBike start={8} speed={-4} lane={10} />

      {/* Permanent warm bridge lamps */}
      {[-12, 0, 12].map((x) =>
        [-5, 5].map((z) => (
          <pointLight
            key={`${x}-${z}`}
            position={[x, 6.45, z]}
            color="#ffb86b"
            intensity={0.3 + night * 2.5}
            distance={8}
            decay={2}
          />
        ))
      )}

      <OrbitControls
        makeDefault
        enablePan
        enableDamping
        dampingFactor={0.08}
        minDistance={10}
        maxDistance={42}
        minPolarAngle={0.25}
        maxPolarAngle={1.48}
        target={[0, 2.2, 0]}
      />
    </>
  );
}


export default function BridgeShelter() {
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{
        position: [13, 13, 19],
        fov: 45,
        near: 0.1,
        far: 150,
      }}
      gl={{
        antialias: true,
        alpha: false,
      }}
    >
      <Scene />
    </Canvas>
  );
}
