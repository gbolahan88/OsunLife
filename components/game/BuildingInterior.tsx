"use client";

import { ArrowLeft } from "lucide-react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";

type FixtureKind =
  | "desk" | "chair" | "bed" | "medical-bed" | "shelf" | "counter"
  | "plant" | "table" | "sofa" | "throne" | "stall" | "clothing-rack"
  | "gallery-art" | "office-desk" | "bar" | "locker" | "display"
  | "car-lift" | "stadium-seat" | "altar" | "cashier" | "dance-light"
  | "treadmill";

type Fixture = { kind: FixtureKind; x: number; z: number; color?: string; rotation?: number };
type InteriorConfig = {
  subtitle: string; floor: string; wall: string; accent: string;
  fixtures: Fixture[];
};

const INTERIORS: Record<string, InteriorConfig> = {
  uniosun: { subtitle: "Campus classroom", floor: "#c9b99b", wall: "#f1e6ce", accent: "#277b68", fixtures: [
    ...[-5, 0, 5].flatMap(x => [-3, 0, 3].map(z => ({ kind: "desk" as const, x, z }))),
    { kind: "counter", x: 0, z: -6, color: "#277b68" },
  ]},
  stadium: { subtitle: "Sports arena", floor: "#467d4c", wall: "#e8e1cf", accent: "#d49b3b", fixtures: [
    ...[-7, -4, -1, 2, 5].flatMap(x => [-4, -2].map(z => ({ kind: "stadium-seat" as const, x, z }))),
    ...[-4, 0, 4].map(x => ({ kind: "treadmill" as const, x, z: 3 })),
  ]},
  hospital: { subtitle: "Hospital ward", floor: "#dce8e6", wall: "#f2f7f4", accent: "#2c9b9b", fixtures: [
    ...[-5, 0, 5].flatMap(x => [-3, 2].map(z => ({ kind: "medical-bed" as const, x, z }))),
    { kind: "counter", x: 0, z: -6, color: "#2c9b9b" }, { kind: "shelf", x: 8, z: 0, color: "#fff" },
  ]},
  palace: { subtitle: "Ààfin — Royal reception hall", floor: "#9f7140", wall: "#e8d2a4", accent: "#9e302b", fixtures: [
    { kind: "throne", x: 0, z: -4, color: "#9e302b" },
    { kind: "plant", x: -9, z: -5 }, { kind: "plant", x: 9, z: -5 },
    { kind: "sofa", x: -5, z: 1, color: "#9e302b" }, { kind: "sofa", x: 5, z: 1, color: "#9e302b" },
    { kind: "table", x: 0, z: 3, color: "#a57b43" },
  ]},
  market: { subtitle: "Oja Oba — Living marketplace", floor: "#b7a080", wall: "#e9d5ae", accent: "#c45e3f", fixtures: [
    { kind: "stall", x: -7, z: -4, color: "#c45e3f" }, { kind: "stall", x: 0, z: -4, color: "#318578" }, { kind: "stall", x: 7, z: -4, color: "#d7a63e" },
    { kind: "stall", x: -7, z: 3, color: "#318578" }, { kind: "stall", x: 0, z: 3, color: "#d7a63e" }, { kind: "stall", x: 7, z: 3, color: "#c45e3f" },
    { kind: "counter", x: 0, z: -7, color: "#8a5a35" },
  ]},
  "adire-tower": { subtitle: "Adire fashion gallery", floor: "#d8c9b5", wall: "#f1e7d9", accent: "#28776e", fixtures: [
    ...[-5, 0, 5].map((x, i) => ({ kind: "clothing-rack" as const, x, z: -2, color: ["#28776e", "#c65a70", "#d39d3b"][i] })),
    ...[-6, 0, 6].map((x, i) => ({ kind: "gallery-art" as const, x, z: -6, color: ["#28776e", "#c65a70", "#d39d3b"][i] })),
    { kind: "cashier", x: 0, z: 4, color: "#28776e" },
  ]},
  "civic-tower": { subtitle: "Civic administration office", floor: "#bfc8c5", wall: "#edf0eb", accent: "#527e83", fixtures: [
    ...[-5, 0, 5].map(x => ({ kind: "office-desk" as const, x, z: -3 })),
    ...[-5, 0, 5].map(x => ({ kind: "chair" as const, x, z: -1 })),
    { kind: "sofa", x: 0, z: 3, color: "#527e83" }, { kind: "plant", x: -8, z: 4 }, { kind: "plant", x: 8, z: 4 },
  ]},
  "bank-tower": { subtitle: "Business office", floor: "#c6c7c2", wall: "#edf0ec", accent: "#355c6c", fixtures: [
    { kind: "cashier", x: 0, z: -5, color: "#355c6c" }, { kind: "office-desk", x: -5, z: -1 }, { kind: "office-desk", x: 5, z: -1 },
    { kind: "chair", x: -5, z: 1 }, { kind: "chair", x: 5, z: 1 }, { kind: "sofa", x: 0, z: 4, color: "#355c6c" },
  ]},
  "grove-gate": { subtitle: "Osun Grove visitor centre", floor: "#8b7952", wall: "#d6d2ae", accent: "#39784b", fixtures: [
    ...[-7, -4, 4, 7].map((x, i) => ({ kind: "plant" as const, x, z: -4 + (i % 2) })),
    { kind: "altar", x: 0, z: -4, color: "#39784b" }, { kind: "table", x: 0, z: 2 }, { kind: "chair", x: -3, z: 4 }, { kind: "chair", x: 3, z: 4 },
  ]},
  "bus-stop": { subtitle: "Central mosque prayer hall", floor: "#d4c8a8", wall: "#f1ead8", accent: "#477d78", fixtures: [
    { kind: "altar", x: 0, z: -5, color: "#477d78" }, { kind: "shelf", x: -7, z: -3 }, { kind: "shelf", x: 7, z: -3 },
    ...[-4, 0, 4].map(x => ({ kind: "table" as const, x, z: 2 })),
  ]},
  shop1: { subtitle: "Local convenience shop", floor: "#c8b99d", wall: "#f0e5d0", accent: "#4d6c70", fixtures: [
    ...[-7, -3, 1, 5].map(x => ({ kind: "shelf" as const, x, z: -3 })),
    { kind: "cashier", x: 5, z: 3, color: "#4d6c70" }, { kind: "display", x: -4, z: 3, color: "#d6a13d" },
  ]},
  barber: { subtitle: "Fresh Cut barbershop", floor: "#b9b8b0", wall: "#e9e8df", accent: "#347d83", fixtures: [
    ...[-5, 0, 5].map(x => ({ kind: "chair" as const, x, z: 0, color: "#242c34" })),
    ...[-5, 0, 5].map(x => ({ kind: "gallery-art" as const, x, z: -6, color: "#347d83" })),
    { kind: "counter", x: 0, z: 4, color: "#347d83" },
  ]},
  restaurant: { subtitle: "Alahja Alamala's Kitchen", floor: "#bba181", wall: "#f0ddbb", accent: "#a65335", fixtures: [
    { kind: "counter", x: 0, z: -5, color: "#a65335" }, ...[-5, 0, 5].map(x => ({ kind: "table" as const, x, z: -1 })),
    ...[-6, -4, -1, 1, 4, 6].map(x => ({ kind: "chair" as const, x, z: 1 })), { kind: "shelf", x: 8, z: -2, color: "#a65335" },
  ]},
  mall: { subtitle: "Shopping mall", floor: "#d4d8d5", wall: "#f3f4f1", accent: "#68616e", fixtures: [
    { kind: "clothing-rack", x: -6, z: -2, color: "#7b8eac" }, { kind: "display", x: -2, z: -2, color: "#c45e3f" },
    { kind: "display", x: 2, z: -2, color: "#d2a43e" }, { kind: "clothing-rack", x: 6, z: -2, color: "#43877b" },
    { kind: "cashier", x: 0, z: 4, color: "#68616e" }, { kind: "sofa", x: -5, z: 4, color: "#68616e" }, { kind: "sofa", x: 5, z: 4, color: "#68616e" },
  ]},
  garage: { subtitle: "Mechanic workshop", floor: "#77756d", wall: "#c8c1af", accent: "#d3a03a", fixtures: [
    { kind: "car-lift", x: -5, z: -2, color: "#d3a03a" }, { kind: "car-lift", x: 5, z: -2, color: "#d3a03a" },
    { kind: "shelf", x: -8, z: 3, color: "#66594a" }, { kind: "shelf", x: 8, z: 3, color: "#66594a" }, { kind: "counter", x: 0, z: 4, color: "#66594a" },
  ]},
  berrymist: { subtitle: "BerryMist Lounge", floor: "#352a3d", wall: "#44374c", accent: "#d6336c", fixtures: [
    { kind: "bar", x: 0, z: -5, color: "#d6336c" }, { kind: "table", x: -5, z: 0, color: "#6d526f" }, { kind: "table", x: 5, z: 0, color: "#6d526f" },
    { kind: "sofa", x: -5, z: 4, color: "#6d526f" }, { kind: "sofa", x: 5, z: 4, color: "#6d526f" },
  ]},
  "circle-lounge": { subtitle: "Circle Lounge", floor: "#253d40", wall: "#344d50", accent: "#2fc4b2", fixtures: [
    { kind: "bar", x: 0, z: -5, color: "#2fc4b2" }, ...[-6, 0, 6].map(x => ({ kind: "table" as const, x, z: 0, color: "#477c77" })),
    { kind: "sofa", x: -5, z: 4, color: "#477c77" }, { kind: "sofa", x: 5, z: 4, color: "#477c77" },
  ]},
  "zeaus-club": { subtitle: "Zeaus Club dance floor", floor: "#211c34", wall: "#302747", accent: "#8b5cf6", fixtures: [
    { kind: "bar", x: 0, z: -5, color: "#8b5cf6" }, ...[-6, 0, 6].map((x, i) => ({ kind: "dance-light" as const, x, z: -1, color: ["#35d9ff", "#f04f9b", "#8b5cf6"][i] })),
    { kind: "sofa", x: -5, z: 4, color: "#4d3e68" }, { kind: "sofa", x: 5, z: 4, color: "#4d3e68" },
  ]},
  olaiya: { subtitle: "Olaiya Flyover rest point", floor: "#888a86", wall: "#d2d0c6", accent: "#d3a03a", fixtures: [
    { kind: "counter", x: 0, z: -4 }, ...[-4, 0, 4].map(x => ({ kind: "chair" as const, x, z: 1 })), { kind: "plant", x: -8, z: 4 }, { kind: "plant", x: 8, z: 4 },
  ]},
};

const DEFAULT_INTERIOR: InteriorConfig = {
  subtitle: "Building interior", floor: "#c9b99b", wall: "#f1e6ce", accent: "#277b68",
  fixtures: [{ kind: "counter", x: 0, z: -5 }, { kind: "table", x: -4, z: 0 }, { kind: "table", x: 4, z: 0 },
    { kind: "chair", x: -5, z: 2 }, { kind: "chair", x: -3, z: 2 }, { kind: "chair", x: 3, z: 2 }, { kind: "chair", x: 5, z: 2 }],
};

function FixtureModel({ fixture }: { fixture: Fixture }) {
  const { kind, x, z, color = "#b99a69", rotation = 0 } = fixture;
  if (kind === "plant") return <group position={[x, 0, z]}>
    <mesh position={[0, .6, 0]}><cylinderGeometry args={[.55, .65, 1.2, 10]} /><meshStandardMaterial color="#9b6843" /></mesh>
    <mesh position={[0, 2.2, 0]}><sphereGeometry args={[1.25, 10, 8]} /><meshStandardMaterial color="#39814b" /></mesh>
    <mesh position={[.6, 2.8, .2]}><sphereGeometry args={[.75, 8, 7]} /><meshStandardMaterial color="#4b9657" /></mesh>
  </group>;

  if (kind === "bed" || kind === "medical-bed") return <group position={[x, 0, z]} rotation={[0, rotation, 0]}>
    <mesh position={[0, .55, 0]}><boxGeometry args={[3.2, .6, 5]} /><meshStandardMaterial color={kind === "medical-bed" ? "#f7f9f7" : "#9e775b"} /></mesh>
    <mesh position={[0, .95, -1.25]}><boxGeometry args={[2.8, .25, 1]} /><meshStandardMaterial color="#fff" /></mesh>
    <mesh position={[0, .95, .65]}><boxGeometry args={[2.8, .2, 2.5]} /><meshStandardMaterial color={kind === "medical-bed" ? "#8fc9d0" : "#427c8c"} /></mesh>
    <mesh position={[0, 1.6, -2.2]}><boxGeometry args={[3.3, 2.2, .2]} /><meshStandardMaterial color="#a9b5b4" /></mesh>
  </group>;

  if (kind === "chair") return <group position={[x, 0, z]} rotation={[0, rotation, 0]}>
    <mesh position={[0, 1, 0]}><boxGeometry args={[1.5, .25, 1.5]} /><meshStandardMaterial color={color} /></mesh>
    <mesh position={[0, 1.9, -.6]}><boxGeometry args={[1.5, 1.6, .25]} /><meshStandardMaterial color={color} /></mesh>
    {[-.55, .55].map(side => [-.55, .55].map(front => <mesh key={`${side}-${front}`} position={[side, .5, front]}><boxGeometry args={[.16, 1, .16]} /><meshStandardMaterial color="#554637" /></mesh>))}
  </group>;

  if (kind === "desk" || kind === "office-desk" || kind === "table") return <group position={[x, 0, z]} rotation={[0, rotation, 0]}>
    <mesh position={[0, 1.25, 0]}><boxGeometry args={[kind === "table" ? 3.4 : 3.2, .25, kind === "table" ? 2.6 : 1.8]} /><meshStandardMaterial color={kind === "office-desk" ? "#9aa9a5" : color} /></mesh>
    {[-1.25, 1.25].map(side => <mesh key={side} position={[side, .6, 0]}><boxGeometry args={[.18, 1.2, 1.5]} /><meshStandardMaterial color="#66513c" /></mesh>)}
    {kind !== "table" && <mesh position={[0, 1.48, 0]}><boxGeometry args={[1.3, .12, .75]} /><meshStandardMaterial color="#e4e8e5" /></mesh>}
  </group>;

  if (kind === "counter" || kind === "cashier" || kind === "bar") return <group position={[x, 0, z]} rotation={[0, rotation, 0]}>
    <mesh position={[0, 1.1, 0]}><boxGeometry args={[5.5, 2.2, 1.5]} /><meshStandardMaterial color={color} /></mesh>
    <mesh position={[0, 2.3, 0]}><boxGeometry args={[5.7, .2, 1.7]} /><meshStandardMaterial color="#e0c9a2" /></mesh>
    {kind === "bar" && [-1.6, 0, 1.6].map(offset => <mesh key={offset} position={[offset, 2.8, 1.3]}><cylinderGeometry args={[.25, .25, .8, 8]} /><meshStandardMaterial color="#e5b95b" /></mesh>)}
    {kind === "cashier" && <mesh position={[0, 2.65, -.15]}><boxGeometry args={[.8, .7, .7]} /><meshStandardMaterial color="#263d31" /></mesh>}
  </group>;

  if (kind === "shelf") return <group position={[x, 0, z]}>
    <mesh position={[0, 2, 0]}><boxGeometry args={[2.8, 4, .65]} /><meshStandardMaterial color="#6b513b" /></mesh>
    {[.8, 2, 3.2].map(height => <mesh key={height} position={[0, height, .4]}><boxGeometry args={[2.9, .16, .9]} /><meshStandardMaterial color="#b59a71" /></mesh>)}
    {[-.8, 0, .8].map((offset, i) => <mesh key={offset} position={[offset, 2.5, .45]}><boxGeometry args={[.45, .8 + (i % 2) * .3, .4]} /><meshStandardMaterial color={i % 2 ? "#d4a13d" : color} /></mesh>)}
  </group>;

  if (kind === "sofa") return <group position={[x, 0, z]} rotation={[0, rotation, 0]}>
    <mesh position={[0, .8, 0]}><boxGeometry args={[4.5, 1, 1.8]} /><meshStandardMaterial color={color} /></mesh>
    <mesh position={[0, 1.6, -.65]}><boxGeometry args={[4.5, 1.5, .45]} /><meshStandardMaterial color={color} /></mesh>
    {[-1.95, 1.95].map(side => <mesh key={side} position={[side, 1.1, 0]}><boxGeometry args={[.5, 1.1, 1.8]} /><meshStandardMaterial color={color} /></mesh>)}
  </group>;

  if (kind === "throne") return <group position={[x, 0, z]}>
    <mesh position={[0, 1.5, 0]}><boxGeometry args={[3, .4, 2.5]} /><meshStandardMaterial color="#d6ad50" metalness={.35} /></mesh>
    <mesh position={[0, 3, -.8]}><boxGeometry args={[3, 3, .4]} /><meshStandardMaterial color={color} /></mesh>
    {[-1.2, 1.2].map(side => <mesh key={side} position={[side, 2.2, 0]}><boxGeometry args={[.35, 1.6, 2.5]} /><meshStandardMaterial color="#d6ad50" metalness={.35} /></mesh>)}
  </group>;

  if (kind === "stall" || kind === "display") return <group position={[x, 0, z]}>
    <mesh position={[0, 1.3, 0]}><boxGeometry args={[3.5, 2.6, 2.5]} /><meshStandardMaterial color={kind === "stall" ? "#9c7851" : color} /></mesh>
    <mesh position={[0, 2.8, 0]}><boxGeometry args={[3.9, .25, 2.9]} /><meshStandardMaterial color={color} /></mesh>
    {[-1, 0, 1].map((offset, i) => <mesh key={offset} position={[offset, 2.1, 1.3]}><boxGeometry args={[.5, .7, .3]} /><meshStandardMaterial color={["#d4a13d", "#bf5943", "#488b74"][i]} /></mesh>)}
  </group>;

  if (kind === "clothing-rack") return <group position={[x, 0, z]}>
    <mesh position={[0, 3, 0]}><boxGeometry args={[4, .18, .18]} /><meshStandardMaterial color="#6b6b67" metalness={.5} /></mesh>
    {[-1.5, 0, 1.5].map((offset, i) => <group key={offset} position={[offset, 0, 0]}>
      <mesh position={[0, 2, 0]}><boxGeometry args={[1.1, 1.8, .25]} /><meshStandardMaterial color={["#277b68", "#c65a70", "#d39d3b"][i]} /></mesh>
      <mesh position={[0, 3, 0]}><boxGeometry args={[.65, .12, .12]} /><meshStandardMaterial color="#c4b9a2" /></mesh>
    </group>)}
    {[-1.8, 1.8].map(offset => <mesh key={offset} position={[offset, 1.5, 0]}><boxGeometry args={[.15, 3, .15]} /><meshStandardMaterial color="#6b6b67" /></mesh>)}
  </group>;

  if (kind === "gallery-art") return <group position={[x, 2.7, z]}>
    <mesh><boxGeometry args={[2.5, 3.2, .25]} /><meshStandardMaterial color="#9d7848" /></mesh>
    <mesh position={[0, 0, .18]}><boxGeometry args={[2.1, 2.8, .12]} /><meshStandardMaterial color={color} /></mesh>
    <mesh position={[0, 0, .27]}><boxGeometry args={[1.2, 1.6, .1]} /><meshStandardMaterial color="#d9bd83" /></mesh>
  </group>;

  if (kind === "car-lift") return <group position={[x, 0, z]}>
    {[-1.5, 1.5].map(side => <mesh key={side} position={[side, 2, 0]}><boxGeometry args={[.3, 4, 5]} /><meshStandardMaterial color={color} /></mesh>)}
    <mesh position={[0, .6, 0]}><boxGeometry args={[3.8, .8, 6]} /><meshStandardMaterial color="#49606a" metalness={.35} /></mesh>
    <mesh position={[0, 1.1, 0]}><boxGeometry args={[2.6, .5, 4.2]} /><meshStandardMaterial color="#c1c5c4" metalness={.4} /></mesh>
  </group>;

  if (kind === "stadium-seat") return <group position={[x, 0, z]}>{[0, 1, 2].map(row => <mesh key={row} position={[0, row * .6 + .4, -row * .25]}><boxGeometry args={[2.4, .5, .6]} /><meshStandardMaterial color={color} /></mesh>)}</group>;

  if (kind === "altar") return <group position={[x, 0, z]}>
    <mesh position={[0, 1, 0]}><boxGeometry args={[4, 2, 2]} /><meshStandardMaterial color={color} /></mesh>
    <mesh position={[0, 2.2, -.3]}><boxGeometry args={[3.6, .3, 1.8]} /><meshStandardMaterial color="#d9c59b" /></mesh>
    <mesh position={[0, 3.5, -.8]}><boxGeometry args={[.35, 2.5, .25]} /><meshStandardMaterial color="#d9c59b" /></mesh>
  </group>;

  if (kind === "locker") return <group position={[x, 0, z]}>
    <mesh position={[0, 2, 0]}><boxGeometry args={[2.2, 4, 1]} /><meshStandardMaterial color={color} /></mesh>
    {[-.5, .5].map(offset => <mesh key={offset} position={[offset, 2, .55]}><boxGeometry args={[.08, 3.5, .1]} /><meshStandardMaterial color="#e0e0da" /></mesh>)}
  </group>;

  if (kind === "dance-light") return <group position={[x, 0, z]}>
    <mesh position={[0, .5, 0]}><cylinderGeometry args={[.7, .9, 1, 12]} /><meshStandardMaterial color="#242035" /></mesh>
    <mesh position={[0, 3.3, 0]}><cylinderGeometry args={[.2, .2, 5, 8]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.4} /></mesh>
    <mesh position={[0, 6, 0]}><sphereGeometry args={[.7, 10, 8]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.8} /></mesh>
  </group>;

  if (kind === "treadmill") return <group position={[x, 0, z]} rotation={[0, rotation, 0]}>
    <mesh position={[0, .6, 0]}><boxGeometry args={[1.6, .2, 4]} /><meshStandardMaterial color="#353a3b" /></mesh>
    <mesh position={[0, 1.7, -1.5]}><boxGeometry args={[.15, 2.4, .15]} /><meshStandardMaterial color="#777d7d" /></mesh>
    <mesh position={[0, 2.8, -1]}><boxGeometry args={[1.5, .15, .15]} /><meshStandardMaterial color="#777d7d" /></mesh>
  </group>;

  return null;
}

type PersonRole = "customer" | "seller" | "food-seller" | "herbalist" | "king" | "chief" | "guard";
type PersonProps = { role: PersonRole; index: number; start: [number, number, number]; color?: string; moving?: boolean };

function Person({ role, index, start, color, moving = true }: PersonProps) {
  const root = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const phase = index * 1.71;
  const skin = ["#8b5438", "#a96d4b", "#6d402d", "#c1845b", "#75452f"][index % 5];
  const outfit = color ?? ["#d6a23d", "#3c8273", "#b84d3d", "#eee0bd", "#496a9a", "#853c6c"][index % 6];
  const isRoyal = role === "king" || role === "chief";
  const height = role === "king" ? 1.1 : role === "guard" ? .92 : .85;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase;
    if (!root.current) return;
    if (moving) {
      const radiusX = role === "customer" ? 4.5 : role === "seller" || role === "food-seller" || role === "herbalist" ? .35 : 2.5;
      const radiusZ = role === "customer" ? 2.7 : .35;
      root.current.position.x = start[0] + Math.sin(t * .36) * radiusX;
      root.current.position.z = start[2] + Math.cos(t * .31) * radiusZ;
      root.current.rotation.y = Math.sin(t * .36 + .5) > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      root.current.position.x = start[0];
      root.current.position.z = start[2];
      root.current.rotation.y = role === "guard" ? 0 : Math.PI;
    }
    const walking = moving ? Math.sin(t * 5.5) : 0;
    if (leftLeg.current) leftLeg.current.rotation.x = walking * .48;
    if (rightLeg.current) rightLeg.current.rotation.x = -walking * .48;
    if (leftArm.current) leftArm.current.rotation.x = -walking * .32 + (role === "seller" ? Math.sin(t * 2) * .18 : 0);
    if (rightArm.current) rightArm.current.rotation.x = walking * .32 + (role === "food-seller" ? Math.sin(t * 2.8) * .25 : 0);
    root.current.position.y = moving ? Math.abs(Math.sin(t * 5.5)) * .045 : Math.sin(t * 1.2) * .015;
  });

  return <group ref={root} position={start}>
    {/* Torso and clothes */}
    <mesh position={[0, 1.35 * height, 0]} castShadow>
      <capsuleGeometry args={[role === "king" ? .48 : .34, role === "king" ? .9 : .68, 5, 8]} />
      <meshStandardMaterial color={isRoyal ? (role === "king" ? "#a72e2e" : outfit) : outfit} roughness={.82} />
    </mesh>
    {/* Head */}
    <mesh position={[0, 2.12 * height, 0]} castShadow>
      <sphereGeometry args={[role === "king" ? .34 : .27, 14, 12]} />
      <meshStandardMaterial color={skin} roughness={.9} />
    </mesh>
    {/* Hair / fila / crown */}
    {role === "king" ? <>
      <mesh position={[0, 2.42 * height, 0]}><cylinderGeometry args={[.38, .3, .34, 12]} /><meshStandardMaterial color="#d5aa48" metalness={.35} /></mesh>
      <mesh position={[0, 2.64 * height, 0]}><sphereGeometry args={[.16, 10, 8]} /><meshStandardMaterial color="#e8c75d" metalness={.45} /></mesh>
      <mesh position={[0, 1.55, .3]}><torusGeometry args={[.31, .07, 6, 14]} /><meshStandardMaterial color="#e6bf5d" metalness={.5} /></mesh>
    </> : <mesh position={[0, 2.32 * height, 0]}><sphereGeometry args={[.29, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={role === "chief" ? "#b38a42" : "#211d1b"} /></mesh>}
    {/* Arms */}
    <group ref={leftArm} position={[-.39, 1.68 * height, 0]}>
      <mesh position={[0, -.28, 0]} rotation={[0, 0, -.14]}><capsuleGeometry args={[.115, .5, 4, 7]} /><meshStandardMaterial color={outfit} /></mesh>
      <mesh position={[-.04, -.57, .02]}><sphereGeometry args={[.105, 8, 8]} /><meshStandardMaterial color={skin} /></mesh>
    </group>
    <group ref={rightArm} position={[.39, 1.68 * height, 0]}>
      <mesh position={[0, -.28, 0]} rotation={[0, 0, .14]}><capsuleGeometry args={[.115, .5, 4, 7]} /><meshStandardMaterial color={outfit} /></mesh>
      <mesh position={[.04, -.57, .02]}><sphereGeometry args={[.105, 8, 8]} /><meshStandardMaterial color={skin} /></mesh>
    </group>
    {/* Legs */}
    <group ref={leftLeg} position={[-.17, .85 * height, 0]}>
      <mesh position={[0, -.34, 0]}><capsuleGeometry args={[.14, .54, 4, 7]} /><meshStandardMaterial color={isRoyal ? outfit : "#34383a"} /></mesh>
      <mesh position={[0, -.66, .08]}><boxGeometry args={[.28, .14, .42]} /><meshStandardMaterial color="#252323" /></mesh>
    </group>
    <group ref={rightLeg} position={[.17, .85 * height, 0]}>
      <mesh position={[0, -.34, 0]}><capsuleGeometry args={[.14, .54, 4, 7]} /><meshStandardMaterial color={isRoyal ? outfit : "#34383a"} /></mesh>
      <mesh position={[0, -.66, .08]}><boxGeometry args={[.28, .14, .42]} /><meshStandardMaterial color="#252323" /></mesh>
    </group>
    {(role === "chief" || role === "king") && <mesh position={[0, 1.1, .28]} rotation={[0, 0, Math.PI / 2]}><torusGeometry args={[.2, .045, 6, 12]} /><meshStandardMaterial color="#e1bd59" metalness={.45} /></mesh>}
    {role === "guard" && <group position={[0, 1.5, .35]}>
      <mesh position={[0, 0, 0]}><boxGeometry args={[.12, .9, .12]} /><meshStandardMaterial color="#d4b77c" /></mesh>
      <mesh position={[0, .48, 0]}><sphereGeometry args={[.12, 8, 8]} /><meshStandardMaterial color="#d4b77c" /></mesh>
    </group>}
  </group>;
}

function MarketGoods({ position, color }: { position: [number, number, number]; color: string }) {
  const produce = ["#d83b2d", "#df9f28", "#5e9b46", "#9c3d2d", "#e2c34d"];
  return <group position={position}>
    {Array.from({ length: 12 }, (_, i) => <mesh key={i} position={[(i % 4) * .58 - .9, .18 + Math.floor(i / 4) * .05, Math.floor(i / 4) * .48 - .5]} castShadow>
      <sphereGeometry args={[.24, 8, 7]} /><meshStandardMaterial color={i % 3 === 0 ? color : produce[i % produce.length]} />
    </mesh>)}
  </group>;
}

function MarketSign({ x, z, text, color }: { x: number; z: number; text: string; color: string }) {
  return <group position={[x, 4.05, z]}>
    <mesh><boxGeometry args={[3.8, .75, .14]} /><meshStandardMaterial color={color} /></mesh>
    <mesh position={[0, -.02, .09]}><boxGeometry args={[3.55, .55, .04]} /><meshStandardMaterial color="#f5e6c6" /></mesh>
    {/* Graphic-like sign stripes are deliberately geometric so no font dependency is required. */}
    {[-1.15, -.75, -.35, .05, .45, .85].map((px, i) => <mesh key={px} position={[px, 0, .13]}><boxGeometry args={[.12, .28 + (i % 2) * .12, .025]} /><meshStandardMaterial color={color} /></mesh>)}
  </group>;
}

function PalaceWallDecor({ accent }: { accent: string }) {
  return <group>
    {[-8, -5.5, -3, 0, 3, 5.5, 8].map((x, i) => <group key={x} position={[x, 3.2, -8.05]}>
      <mesh><boxGeometry args={[1.45, 1.65, .08]} /><meshStandardMaterial color="#a77a42" /></mesh>
      <mesh position={[0, 0, .06]}><boxGeometry args={[1.23, 1.43, .06]} /><meshStandardMaterial color={i % 2 ? "#ead4a6" : accent} /></mesh>
      <mesh position={[0, 0, .1]}><torusGeometry args={[.39, .09, 5, 4]} /><meshStandardMaterial color="#d4ad5d" metalness={.25} /></mesh>
      <mesh position={[0, 0, .14]} rotation={[0, 0, Math.PI / 4]}><boxGeometry args={[.58, .58, .04]} /><meshStandardMaterial color={i % 2 ? accent : "#d7b35e"} /></mesh>
    </group>)}
    {[-7, -3.5, 0, 3.5, 7].map(x => <mesh key={x} position={[x, 1.1, -7.95]}><boxGeometry args={[.18, 1.3, .1]} /><meshStandardMaterial color="#d6b66f" /></mesh>)}
  </group>;
}

function MarketActivity() {
  const shoppers = useMemo(() => [
    { role: "customer" as const, start: [-4.5, 0, 0.2] as [number, number, number] },
    { role: "customer" as const, start: [3.7, 0, 1] as [number, number, number] },
    { role: "customer" as const, start: [-1.5, 0, 5.4] as [number, number, number] },
    { role: "customer" as const, start: [5.1, 0, -1.2] as [number, number, number] },
    { role: "customer" as const, start: [-5.1, 0, -1.1] as [number, number, number] },
  ], []);
  return <>
    {shoppers.map((p, i) => <Person key={`shopper-${i}`} role={p.role} index={i} start={p.start} />)}
    <Person role="seller" index={6} start={[-7, 0, -2.25]} moving />
    <Person role="seller" index={7} start={[0, 0, -2.25]} moving />
    <Person role="herbalist" index={8} start={[7, 0, -2.25]} color="#6f8a43" moving />
    <Person role="food-seller" index={9} start={[-7, 0, 4.6]} color="#c85a35" moving />
    <Person role="seller" index={10} start={[0, 0, 4.6]} color="#c18a32" moving />
    <Person role="food-seller" index={11} start={[7, 0, 4.6]} color="#bd4b39" moving />
    <MarketGoods position={[-7, 2.95, -2.65]} color="#d83b2d" />
    <MarketGoods position={[0, 2.95, -2.65]} color="#5e9b46" />
    <MarketGoods position={[7, 2.95, -2.65]} color="#df9f28" />
    <MarketGoods position={[-7, 2.95, 4.35]} color="#df9f28" />
    <MarketGoods position={[0, 2.95, 4.35]} color="#d83b2d" />
    <MarketGoods position={[7, 2.95, 4.35]} color="#5e9b46" />
    <MarketSign x={-7} z={-4.05} text="GROCERIES" color="#b84d3d" />
    <MarketSign x={0} z={-4.05} text="TALILOT SHOP" color="#28776e" />
    <MarketSign x={7} z={-4.05} text="AGBO" color="#88733b" />
    <MarketSign x={-7} z={2.95} text="STREET FOOD" color="#b84d3d" />
    <MarketSign x={0} z={2.95} text="PROVISIONS" color="#28776e" />
    <MarketSign x={7} z={2.95} text="FOOD SELLER" color="#b84d3d" />
  </>;
}

function PalaceActivity() {
  return <>
    <PalaceWallDecor accent="#9e302b" />
    <Person role="king" index={20} start={[0, 0, -3.35]} moving={false} />
    <Person role="chief" index={21} start={[-3.8, 0, -1.1]} color="#d1a448" moving={false} />
    <Person role="chief" index={22} start={[3.8, 0, -1.1]} color="#347b6b" moving={false} />
    <Person role="chief" index={23} start={[-5.2, 0, 1.4]} color="#74418a" moving={false} />
    <Person role="chief" index={24} start={[5.2, 0, 1.4]} color="#c15b3d" moving={false} />
    <Person role="guard" index={25} start={[-8.7, 0, -5.6]} color="#253e39" moving={false} />
    <Person role="guard" index={26} start={[8.7, 0, -5.6]} color="#253e39" moving={false} />
    <Person role="guard" index={27} start={[-8.7, 0, 5.1]} color="#253e39" moving={false} />
    <Person role="guard" index={28} start={[8.7, 0, 5.1]} color="#253e39" moving={false} />
  </>;
}

function InteriorScene({ config, buildingId }: { config: InteriorConfig; buildingId: string }) {
  return <>
    <color attach="background" args={["#c8d7d2"]} />
    <ambientLight intensity={1.6} />
    <directionalLight position={[-5, 12, 8]} intensity={2} castShadow />
    <hemisphereLight args={["#fff1d6", "#75654b", 0.55]} />
    <mesh position={[0, -.15, 0]} receiveShadow><boxGeometry args={[23, .3, 17]} /><meshStandardMaterial color={config.floor} roughness={.9} /></mesh>
    <mesh position={[0, 2.4, -8.3]} receiveShadow><boxGeometry args={[23, 5, .35]} /><meshStandardMaterial color={config.wall} roughness={.9} /></mesh>
    <mesh position={[-11.3, 2.4, 0]} receiveShadow><boxGeometry args={[.35, 5, 17]} /><meshStandardMaterial color={config.wall} roughness={.9} /></mesh>
    <mesh position={[11.3, 2.4, 0]} receiveShadow><boxGeometry args={[.35, 5, 17]} /><meshStandardMaterial color={config.wall} roughness={.9} /></mesh>
    <mesh position={[0, 4.85, -8.1]}><boxGeometry args={[22.5, .15, .25]} /><meshStandardMaterial color={config.accent} /></mesh>
    <mesh position={[0, 1.8, -8.05]}><boxGeometry args={[4, 2.9, .2]} /><meshStandardMaterial color={config.accent} /></mesh>
    <mesh position={[0, 3.2, -7.9]}><boxGeometry args={[1.1, .15, .1]} /><meshStandardMaterial color="#f4e8ce" /></mesh>
    {config.fixtures.map((fixture, index) => <FixtureModel key={`${fixture.kind}-${index}`} fixture={fixture} />)}
    {buildingId === "market" && <MarketActivity />}
    {buildingId === "palace" && <PalaceActivity />}
  </>;
}

export default function BuildingInterior({ buildingId, buildingName, onExit }: {
  buildingId: string; buildingName: string; onExit: () => void;
}) {
  const config = INTERIORS[buildingId] ?? DEFAULT_INTERIOR;
  return <div className="absolute inset-0 z-20 overflow-hidden bg-[#c8d7d2]">
    <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 10, 19], fov: 48, near: .1, far: 100 }} gl={{ antialias: true }}>
      <OrbitControls makeDefault enablePan={false} enableRotate enableZoom minDistance={12} maxDistance={27} maxPolarAngle={Math.PI / 2.05} target={[0, 1.5, 0]} />
      <InteriorScene config={config} buildingId={buildingId} />
    </Canvas>
    <div className="pointer-events-none absolute inset-0">
      <div className="pointer-events-auto absolute left-3 top-[calc(env(safe-area-inset-top)+7rem)] flex max-w-[calc(100%-1.5rem)] items-center gap-2 sm:left-4">
        <button type="button" onClick={onExit} aria-label="Return to map" title="Return to map" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/90 bg-white/95 text-[#263d31] shadow-lg transition-transform hover:scale-105">
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 max-w-[calc(100vw-5rem)] rounded-md border border-white/50 bg-white/80 px-3 py-2 shadow-lg backdrop-blur">
          <p className="truncate text-[9px] font-bold uppercase tracking-[0.12em] text-[#728274]">{config.subtitle}</p>
          <h1 className="truncate text-sm font-extrabold text-[#263d31]">{buildingName}</h1>
        </div>
      </div>
    </div>
  </div>;
}