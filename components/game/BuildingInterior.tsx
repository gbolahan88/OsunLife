"use client";

import { ArrowLeft, ChevronDown } from "lucide-react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import * as THREE from "three";
import CharacterModel from "@/components/game/CharacterModel";
import { VenueFxLayer, useVenueFx } from "@/components/game/ClubFx";
import VenuePanel from "@/components/game/VenuePanel";
import {
  CLUB_BOXES,
  ClubLights,
  DanceFloor,
  ZeusClubProps,
  type ObstacleBox,
} from "@/components/game/ZeusClub";
import {
  useMultiplayer,
  type RemotePlayer,
} from "@/components/multiplayer/MultiplayerProvider";
import {
  useRoomSync,
  type RemotePose,
  type RoomAction,
  type RoomEvent,
  type RoomPose,
} from "@/components/multiplayer/useRoomSync";
import {
  CharacterAppearance,
  DEFAULT_CHARACTER_APPEARANCE,
} from "@/store/characterAppearance";
import { useGameStore } from "@/store/gameStore";
import {
  REACTIONS,
  findAction,
  isVenue,
  type VenueAction,
  type VenueSpot,
} from "@/lib/venue";
import { MAP_TASKS } from "@/lib/mapTasks";
import { MoneyDropsLayer, useMoneyDrops } from "@/components/game/MoneyDrops";
import {
  useVenueRealtime,
  type MoneyDropRow,
  type VenueEventRow,
} from "@/components/multiplayer/useVenueRealtime";
import {
  getCrimeState,
  performCrimeAction,
  type CrimeAction,
  type CrimeResult,
  venueBuy,
} from "@/lib/wallet";
import { formatNaira } from "@/lib/format";


type BuyResult = { ok: true } | { ok: false; reason: string };
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
  market: {
    subtitle: "Oja Oba — Living marketplace",
    floor: "#6b4c3a", // Dirt floor
    wall: "#e9d5ae",
    accent: "#bc6345",
    fixtures: [
      // Top row
      { kind: "stall", x: -6, z: -5, color: "#bc6345" },
      { kind: "stall", x: 0, z: -5, color: "#28776e" },
      { kind: "stall", x: 6, z: -5, color: "#bc6345" },
      // Middle row (produce tables)
      { kind: "table", x: -4, z: 0, color: "#5c3a21" },
      { kind: "table", x: 4, z: 0, color: "#5c3a21" },
      // Bottom row
      { kind: "stall", x: -6, z: 5, color: "#d7a63e" },
      { kind: "stall", x: 0, z: 5, color: "#318578" },
      { kind: "stall", x: 6, z: 5, color: "#bc6345" },
    ],
  },
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
  bank: { 
    subtitle: "Osun Community Bank", 
    floor: "#e5e3df", 
    wall: "#f0f0f0", 
    accent: "#2d4a5c", 
    fixtures: [
      // Vault door on the right
      { kind: "locker", x: 9, z: -5, color: "#333" },
    ]
  },
  "state-cid": { subtitle: "State CID holding station", floor: "#b9c1c2", wall: "#e5e8e4", accent: "#344b67", fixtures: [
  ]},
  "federal-high-court": { subtitle: "Federal High Court", floor: "#b49a73", wall: "#eee4d0", accent: "#82704f", fixtures: [
    { kind: "throne", x: 0, z: -5, color: "#82704f" },
    ...[-6, -2, 2, 6].map((x) => ({ kind: "stadium-seat" as const, x, z: 3 })),
    { kind: "office-desk", x: 0, z: 0 },
  ]},
  church: { subtitle: "Osogbo Community Church", floor: "#b9aa8c", wall: "#f0e9dc", accent: "#9b5442", fixtures: [
    { kind: "altar", x: 0, z: -5, color: "#9b5442" },
    ...[-6, -2, 2, 6].map((x) => ({ kind: "stadium-seat" as const, x, z: 0 })),
    ...[-6, -2, 2, 6].map((x) => ({ kind: "stadium-seat" as const, x, z: 3 })),
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
  berrymist: { subtitle: "BerryMist Lounge", floor: "#352a3d", wall: "#44374c", accent: "#d6336c", fixtures: [] },
  "circle-lounge": { subtitle: "Circle Lounge", floor: "#253d40", wall: "#344d50", accent: "#2fc4b2", fixtures: [] },
  // The DJ booth, bar, VIP sofa, staff and dancing crowd are drawn by ZeusClubProps (ZeusClub.tsx)
  "zeus-club": {
    subtitle: "Zeus Club dance floor",
    floor: "#1d1530",
    wall: "#241a3a",
    accent: "#8b5cf6",
    fixtures: [
      ...[-6, 0, 6].map((x, i) => ({ kind: "dance-light" as const, x, z: -2, color: ["#35d9ff", "#f04f9b", "#8b5cf6"][i] })),
    ],
  },
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

  if (kind === "stall" || kind === "display") {
    // Split the color to make it striped (e.g. Red and White)
    const color2 = color === "#bc6345" ? "#f5e6c6" : color === "#28776e" ? "#f5e6c6" : "#d1b272";

    return <group position={[x, 0, z]}>
      {/* Wooden posts */}
      {[-1.4, 1.4].map(px => [-1.4, 1.4].map(pz => (
        <mesh key={`${px}-${pz}`} position={[px, 1.5, pz]} castShadow>
          <boxGeometry args={[0.15, 3, 0.15]} />
          <meshStandardMaterial color="#4a331f" />
        </mesh>
      )))}

      {/* Counter table */}
      <mesh position={[0, 1.2, 0]} castShadow>
        <boxGeometry args={[3, 0.15, 3]} />
        <meshStandardMaterial color="#8c684a" />
      </mesh>

      {/* Striped canopy (angled) */}
      <group position={[0, 3.2, 0]}>
        {Array.from({ length: 6 }).map((_, i) => (
          <mesh key={i} position={[-1.25 + i * 0.5, 0, 0]} rotation={[0, 0, 0.1]} castShadow>
            <boxGeometry args={[0.5, 0.05, 3.8]} />
            <meshStandardMaterial color={i % 2 === 0 ? color : color2} />
          </mesh>
        ))}
      </group>

      {/* Produce crates on the counter */}
      <mesh position={[-0.8, 1.4, 0]} castShadow>
        <boxGeometry args={[0.8, 0.4, 1.2]} />
        <meshStandardMaterial color="#a67c52" />
      </mesh>
      <mesh position={[0.8, 1.4, 0.2]} castShadow>
        <boxGeometry args={[1, 0.4, 0.8]} />
        <meshStandardMaterial color="#a67c52" />
      </mesh>

      {/* Small fruits on the crates */}
      {[-0.8, -0.6, -1.0].map((fx, i) => (
        <mesh key={`a-${i}`} position={[fx, 1.65, 0]} castShadow>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshStandardMaterial color={i % 2 === 0 ? "#d83b2d" : "#5e9b46"} />
        </mesh>
      ))}
      {[0.8, 1.0, 0.6].map((fx, i) => (
        <mesh key={`b-${i}`} position={[fx, 1.65, 0.2]} castShadow>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshStandardMaterial color={i % 2 === 0 ? "#df9f28" : "#d83b2d"} />
        </mesh>
      ))}
    </group>;
  }

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

function LoungeModel({
  url,
  position,
  rotation = 0,
  maxSize,
}: {
  url: string;
  position: [number, number, number];
  rotation?: number;
  maxSize: [number, number, number];
}) {
  const { scene } = useGLTF(url);
  const { model, scale, offset } = useMemo(() => {
    const model = scene.clone(true);
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        // Force opaque to fix the ghosting
        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((m) => {
            m.transparent = false;
            m.opacity = 1;
            m.depthWrite = true;
          });
        }
      }
    });

    const bounds = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    bounds.getSize(size);
    bounds.getCenter(center);
    
    // Scale to fit maxSize
    const scale = Math.min(
      maxSize[0] / size.x,
      maxSize[1] / size.y,
      maxSize[2] / size.z,
    );

    return {
      model,
      scale,
      // Center X/Z, place bottom on the floor (Y = 0)
      offset: [-center.x * scale, -bounds.min.y * scale, -center.z * scale] as [number, number, number],
    };
  }, [scene, maxSize]);

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <group position={offset} scale={scale}>
        <primitive object={model} />
      </group>
    </group>
  );
}

function LoungeGuests({
  buildingId,
  position,
  rotation,
  index,
}: {
  buildingId: string;
  position: [number, number, number];
  rotation: number;
  index: number;
}) {
  const colors = buildingId === "berrymist"
    ? ["#d6336c", "#e5b95b", "#a64b70"]
    : ["#2fc4b2", "#d6a23d", "#347b6b"];

  // 0 gets 2 guests, 1 gets 1 guest, 2 & 3 get 0 guests
  const guestCount = index === 0 ? 2 : index === 1 ? 1 : 0;

  const guests = [
    { x: 0, z: -0.7, rot: 0 },      // Front sofa
    { x: -0.7, z: -0.7, rot: 0 },  // Left chair
  ];

  // Slice the array based on the guestCount
  const visibleGuests = guests.slice(0, guestCount);

  // If there are no guests to render, return null (no TypeScript error!)
  if (visibleGuests.length === 0) return null;

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {visibleGuests.map((g, i) => (
        <group key={i} position={[g.x, 0.45, g.z]} rotation={[0, g.rot, 0]}>
          <CharacterModel
            appearance={{ ...DEFAULT_CHARACTER_APPEARANCE, shirt: colors[i] }}
            targetHeight={PERSON_HEIGHT}
            action="sit"
          />
        </group>
      ))}
    </group>
  );
}

/* ───────────── Palace people (simple figures) ───────────── */

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

/* ───────────── Walking inside a building ───────────── */

const PERSON_HEIGHT = 2;
const PLAYER_RADIUS = 0.45;
const WALK_SPEED = 5;
const SPAWN_X = 0;
const SPAWN_Z = 6.2;
const MAX_VISIBLE_PLAYERS = 18;
const ROOM = { minX: -10.4, maxX: 10.4, minZ: -7.4, maxZ: 7.4 };
const LOUNGE_BUILDINGS = new Set(["berrymist", "circle-lounge"]);
const LOUNGE_BAR_MAX_SIZE: [number, number, number] = [4.8, 2.8, 2.8];
const LOUNGE_SET_MAX_SIZE: [number, number, number] = [7.2, 2.4, 3.6];

const BAR_STOOLS = [
  { x: -1.5, z: -5.2 }, { x: 0, z: -5.2 }, { x: 1.5, z: -5.2 }
];

const LOUNGE_SEATS = [
  // Set 1
  { x: -5.5, z: 1.5, ry: 1.8 - Math.PI / 2}, { x: -5.5, z: 6.5, ry: Math.PI },
  // Set 2
  { x: 5.7, z: 6.5, ry: 1.8 + Math.PI / 2}, { x: 5.7, z: 1.8, ry: 0.8 - Math.PI /2},
  // Set 3
  { x: -4.2, z: -4.8, ry: 1.8 - Math.PI / 2}, { x: -7, z: -0.9, ry: Math.PI / 2},
  // Set 4
  { x: 4.2, z: -4.8, ry: 1.8 - Math.PI / 2}, { x: 7, z: -0.9, ry: 2.3 + Math.PI / 2},
];


type Box = ObstacleBox;

/** Half-width / half-depth of each fixture, used to stop players walking through furniture. */
const FOOTPRINTS: Partial<Record<FixtureKind, [number, number]>> = {
  desk: [1.6, 0.9], "office-desk": [1.6, 0.9], table: [1.7, 1.3],
  bed: [1.6, 2.5], "medical-bed": [1.6, 2.5], chair: [0.75, 0.75],
  shelf: [1.4, 0.4], counter: [2.85, 0.85], cashier: [2.85, 0.85], bar: [2.85, 0.85],
  plant: [0.65, 0.65], sofa: [2.25, 0.9], throne: [1.5, 1.25],
  stall: [1.6, 1.6], display: [1.75, 1.25], "clothing-rack": [2, 0.35],
  "car-lift": [1.9, 3], "stadium-seat": [1.2, 0.9], altar: [2, 1],
  locker: [1.1, 0.5], "dance-light": [0.9, 0.9], treadmill: [0.8, 2],
};

function buildObstacles(buildingId: string, fixtures: Fixture[]): Box[] {
  const boxes: Box[] = [];
  for (const fixture of fixtures) {
    const footprint = FOOTPRINTS[fixture.kind];
    if (!footprint) continue;
    const rotation = fixture.rotation ?? 0;
    const c = Math.abs(Math.cos(rotation));
    const s = Math.abs(Math.sin(rotation));
    boxes.push({
      x: fixture.x,
      z: fixture.z,
      hw: c * footprint[0] + s * footprint[1],
      hd: s * footprint[0] + c * footprint[1],
    });
  }
  if (buildingId === "zeus-club") boxes.push(...CLUB_BOXES);
  if (LOUNGE_BUILDINGS.has(buildingId)) {
    boxes.push(
      { x: 0, z: -5, hw: 2.4, hd: 1.4 },
      { x: 0, z: -0.65, hw: 3.2, hd: 1.05 },
    );
  }
  return boxes;
}

/** Push a circle out of every box and keep it inside the room. */
function resolveCircle(boxes: Box[], startX: number, startZ: number, radius = PLAYER_RADIUS): [number, number] {
  let x = startX;
  let z = startZ;
  for (let pass = 0; pass < 3; pass += 1) {
    for (const box of boxes) {
      const nearestX = Math.min(Math.max(x, box.x - box.hw), box.x + box.hw);
      const nearestZ = Math.min(Math.max(z, box.z - box.hd), box.z + box.hd);
      const dx = x - nearestX;
      const dz = z - nearestZ;
      const distance = Math.hypot(dx, dz);
      if (distance >= radius) continue;
      if (distance > 1e-6) {
        x += (dx / distance) * (radius - distance);
        z += (dz / distance) * (radius - distance);
      } else {
        // Centre is inside the box: leave by the nearest side
        const pushX = box.hw + radius - Math.abs(x - box.x);
        const pushZ = box.hd + radius - Math.abs(z - box.z);
        if (pushX < pushZ) x += (x >= box.x ? 1 : -1) * pushX;
        else z += (z >= box.z ? 1 : -1) * pushZ;
      }
    }
  }
  return [
    Math.min(Math.max(x, ROOM.minX), ROOM.maxX),
    Math.min(Math.max(z, ROOM.minZ), ROOM.maxZ),
  ];
}

function lerpAngle(from: number, to: number, amount: number) {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return from + diff * amount;
}

function NameTag({
  name,
  you = false,
  bubble,
  onClick,
}: {
  name: string;
  you?: boolean;
  bubble?: string;
  onClick?: () => void;
}) {
  return (
    <Html position={[0, PERSON_HEIGHT + 0.5, 0]} center zIndexRange={[100, 0]}>
      <div className="flex flex-col items-center gap-1">
        {bubble && (
          <span className="rounded-full bg-white/95 px-2.5 py-0.5 text-lg leading-tight shadow-lg">
            {bubble}
          </span>
        )}
        <button
          type="button"
          onClick={onClick}
          disabled={!onClick}
          aria-label={you ? "You" : `Message ${name}`}
          className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-bold text-white shadow-lg backdrop-blur ${
            you ? "border-[#20b978]/70 bg-[#0f3a2b]/85" : "border-white/40 bg-[#101c2b]/85"
          }`}
        >
          {you ? `${name} (you)` : name}
        </button>
      </div>
    </Html>
  );
}

function LocalPlayer({
  appearance,
  username,
  bubble,
  boxes,
  dancing,
  sitting,
  confined,
  localRef,
  targetRef,
}: {
  appearance: CharacterAppearance;
  username: string;
  bubble?: string;
  boxes: Box[];
  dancing: boolean;
  sitting: boolean;
  confined: boolean;
  localRef: MutableRefObject<RoomPose>;
  targetRef: MutableRefObject<{ x: number; z: number; ry?: number } | null>;
}) {
  const pos = useRef<THREE.Group>(null);
  const rot = useRef<THREE.Group>(null);
  const facing = useRef(0);
  const stuck = useRef(0);
  const actionRef = useRef<RoomAction>("idle");
  const [action, setAction] = useState<RoomAction>("idle");
  const [spawn] = useState<[number, number, number]>(() => {
    const [x, z] = resolveCircle(boxes, confined ? -7 : SPAWN_X, confined ? -4 : SPAWN_Z);
    return [x, 0, z];
  });

  useFrame((_, delta) => {
    const g = pos.current;
    const r = rot.current;
    if (!g || !r) return;

    let moving = false;
    const target = targetRef.current;
    if (target) {
      const dx = target.x - g.position.x;
      const dz = target.z - g.position.z;
      const distance = Math.hypot(dx, dz);

      if (distance < 0.08) {
        targetRef.current = null;
        stuck.current = 0;

        if (target.ry !== undefined) {
          facing.current = target.ry;
        }
      } else {
        const step = Math.min(distance, WALK_SPEED * delta);
        const [resolvedX, resolvedZ] = resolveCircle(
          boxes,
          g.position.x + (dx / distance) * step,
          g.position.z + (dz / distance) * step,
        );
        const nx = confined ? THREE.MathUtils.clamp(resolvedX, -10, -4) : resolvedX;
        const nz = confined ? THREE.MathUtils.clamp(resolvedZ, -6, -2) : resolvedZ;
        const moved = Math.hypot(nx - g.position.x, nz - g.position.z);
        g.position.x = nx;
        g.position.z = nz;
        facing.current = Math.atan2(dx, dz);
        moving = true;

        // Pressed against a wall or table: stop trying
        if (moved < step * 0.25) {
          stuck.current += delta;
          if (stuck.current > 0.35) {
            targetRef.current = null;
            stuck.current = 0;
            moving = false;
          }
        } else {
          stuck.current = 0;
        }
      }
    }

    r.rotation.y = lerpAngle(r.rotation.y, facing.current, Math.min(1, delta * 12));

    const next: RoomAction = moving ? "walk" : sitting ? "sit" : dancing ? "dance" : "idle";
    if (next !== actionRef.current) {
      actionRef.current = next;
      setAction(next);
    }
    g.position.y = THREE.MathUtils.lerp(
      g.position.y,
      next === "sit" ? 0.45 : 0,
      Math.min(1, delta * 8),
    );
    localRef.current = { x: g.position.x, z: g.position.z, ry: r.rotation.y, action: next };
  });

  return (
    <group ref={pos} position={spawn}>
      <group ref={rot}>
        <CharacterModel appearance={appearance} targetHeight={PERSON_HEIGHT} action={action} />
      </group>
      <NameTag name={username} you bubble={bubble} />
    </group>
  );
}

function RemotePlayerFigure({
  player,
  slot,
  bubble,
  remote,
  onChat,
}: {
  player: RemotePlayer;
  slot: [number, number];
  bubble?: string;
  remote: MutableRefObject<Map<string, RemotePose>>;
  onChat: (player: RemotePlayer) => void;
}) {
  const pos = useRef<THREE.Group>(null);
  const rot = useRef<THREE.Group>(null);
  const actionRef = useRef<RoomAction>("idle");
  const [action, setAction] = useState<RoomAction>("idle");
  // Until their first position arrives they wait in the front row
  const [start] = useState<[number, number, number]>(() => [slot[0], 0, slot[1]]);

  useFrame((_, delta) => {
    const g = pos.current;
    const r = rot.current;
    if (!g || !r) return;

    const pose = remote.current.get(player.userId);
    const k = Math.min(1, delta * 10);
    let next: RoomAction = "idle";

    if (pose) {
      g.position.x += (pose.x - g.position.x) * k;
      g.position.z += (pose.z - g.position.z) * k;
      r.rotation.y = lerpAngle(r.rotation.y, pose.ry, k);
      next = pose.action;
    }
    g.position.y += ((next === "sit" ? 0.45 : 0) - g.position.y) * k;

    if (next !== actionRef.current) {
      actionRef.current = next;
      setAction(next);
    }
  });

  return (
    <group ref={pos} position={start}>
      <group
        ref={rot}
        onClick={(event) => {
          event.stopPropagation();
          onChat(player);
        }}
        onPointerOver={() => { document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { document.body.style.cursor = "auto"; }}
      >
        <CharacterModel appearance={player.appearance} targetHeight={PERSON_HEIGHT} action={action} />
        {/* Invisible, easier-to-tap hit area */}
        <mesh position={[0, PERSON_HEIGHT / 2, 0]}>
          <cylinderGeometry args={[0.9, 0.9, PERSON_HEIGHT, 8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
      <NameTag name={player.username} bubble={bubble} onClick={() => onChat(player)} />
    </group>
  );
}

function RemotePlayers({
  players,
  bubbles,
  remote,
  onChat,
}: {
  players: RemotePlayer[];
  bubbles: Record<string, string>;
  remote: MutableRefObject<Map<string, RemotePose>>;
  onChat: (player: RemotePlayer) => void;
}) {
  const sorted = useMemo(
    () =>
      [...players]
        .sort((a, b) => a.userId.localeCompare(b.userId))
        .slice(0, MAX_VISIBLE_PLAYERS),
    [players]
  );

  return (
    <Suspense fallback={null}>
      {sorted.map((player, index) => (
        <RemotePlayerFigure
          key={player.userId}
          player={player}
          slot={[-9.6 + (index % 9) * 2.4, 6.2 + Math.floor(index / 9) * 1.5]}
          bubble={bubbles[player.userId]}
          remote={remote}
          onChat={onChat}
        />
      ))}
    </Suspense>
  );
}

/* ───────────── Market crowd ───────────── */

type Trader = { x: number; z: number; color: string };
type Passerby = { color: string; speed: number; radius: number; offset: number };

const MARKET_TRADERS: Trader[] = [
  { x: -6, z: -6.5, color: "#d6a23d" },
  { x: 0, z: -6.5, color: "#b84d3d" },
  { x: 6, z: -6.5, color: "#3c8273" },
  { x: -6, z: 6.5, color: "#496a9a" },
  { x: 0, z: 6.5, color: "#853c6c" },
  { x: 6, z: 6.5, color: "#d6a23d" },
];

const MARKET_PASSERSBY: Passerby[] = [
  { color: "#b84d3d", speed: 0.5, radius: 3, offset: 0 },
  { color: "#3c8273", speed: 0.4, radius: 4, offset: Math.PI },
  { color: "#d6a23d", speed: 0.6, radius: 2.5, offset: Math.PI },
  { color: "#496a9a", speed: 0.45, radius: 5, offset: -Math.PI / 2 },
];

function MovingPasserby({ color, speed, radius, offset }: Passerby) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime * speed + offset;
    groupRef.current.position.set(Math.cos(t) * radius, 0, Math.sin(t) * radius);
    // Face the way they are walking
    groupRef.current.rotation.y = Math.atan2(-Math.sin(t) * radius, Math.cos(t) * radius);
  });

  return (
    <group ref={groupRef}>
      <CharacterModel appearance={{ ...DEFAULT_CHARACTER_APPEARANCE, shirt: color }} targetHeight={PERSON_HEIGHT} action="walk" />
    </group>
  );
}

function MarketCrowd() {
  return (
    <Suspense fallback={null}>
      <group>
        {MARKET_TRADERS.map((trader, i) => (
          <group key={`trader-${i}`} position={[trader.x, 0, trader.z]} rotation={[0, trader.z > 0 ? Math.PI : 0, 0]}>
            <CharacterModel appearance={{ ...DEFAULT_CHARACTER_APPEARANCE, shirt: trader.color }} targetHeight={PERSON_HEIGHT} action="idle" />
          </group>
        ))}
        {MARKET_PASSERSBY.map((walker, i) => (
          <MovingPasserby key={`walker-${i}`} {...walker} />
        ))}
      </group>
    </Suspense>
  );
}

function DetentionCell() {
    const barPositions = Array.from({ length: 12 }, (_, index) => -3.2 + index * 0.58);
    const sidePositions = Array.from({ length: 8 }, (_, index) => -2 + index * 0.58);
    const inmates = [
      { name: "Criminal 1", position: [-1.25, 0, 0.2] as [number, number, number], shirt: "#b94f45" },
      { name: "Criminal 2", position: [1.25, 0, 0.2] as [number, number, number], shirt: "#527a9a" },
    ];

    return (
      <group position={[-7, 0, -5.5]}>
        <mesh position={[0, 0, 0]} receiveShadow>
          <boxGeometry args={[7, 0.12, 5]} />
          <meshStandardMaterial color="#77766e" />
        </mesh>
        <mesh position={[0, 0.52, -1.35]} castShadow>
          <boxGeometry args={[4.2, 0.35, 0.9]} />
          <meshStandardMaterial color="#665440" roughness={0.85} />
        </mesh>
        {[-1.8, 1.8].map((x) => (
          <mesh key={x} position={[x, 0.25, -1.35]}>
            <boxGeometry args={[0.18, 0.55, 0.72]} />
            <meshStandardMaterial color="#4d4034" />
          </mesh>
        ))}
        <mesh position={[0, 0.08, 0]}>
          <boxGeometry args={[7.2, 0.08, 5.2]} />
          <meshStandardMaterial color="#30383a" />
        </mesh>
        <mesh position={[-3.5, 1.55, 0]}><boxGeometry args={[0.12, 3.1, 5.1]} /><meshStandardMaterial color="#30383a" metalness={0.75} /></mesh>
        <mesh position={[3.5, 1.55, 0]}><boxGeometry args={[0.12, 3.1, 5.1]} /><meshStandardMaterial color="#30383a" metalness={0.75} /></mesh>
        <mesh position={[0, 1.55, -2.5]}><boxGeometry args={[7.1, 3.1, 0.12]} /><meshStandardMaterial color="#30383a" metalness={0.75} /></mesh>
        {barPositions.map((x) => (
          <mesh key={`front-${x}`} position={[x, 1.55, 2.5]}>
            <cylinderGeometry args={[0.045, 0.045, 3.1, 6]} />
            <meshStandardMaterial color="#30383a" metalness={0.8} roughness={0.35} />
          </mesh>
        ))}
        {[-1, 2.95].map((y) => (
          <mesh key={y} position={[0, y, 2.5]}>
            <boxGeometry args={[7.1, 0.1, 0.1]} />
            <meshStandardMaterial color="#30383a" metalness={0.8} />
          </mesh>
        ))}
        {sidePositions.flatMap((z) =>
          [-3.5, 3.5].map((x) => (
            <mesh key={`${x}-${z}`} position={[x, 1.55, z]}>
              <cylinderGeometry args={[0.045, 0.045, 3.1, 6]} />
              <meshStandardMaterial color="#30383a" metalness={0.8} roughness={0.35} />
            </mesh>
          ))
        )}
        <Suspense fallback={null}>
          {inmates.map((inmate, index) => (
            <group key={inmate.name} position={inmate.position}>
              <CharacterModel
                appearance={{ ...DEFAULT_CHARACTER_APPEARANCE, shirt: inmate.shirt }}
                targetHeight={PERSON_HEIGHT}
                action={index === 0 ? "sit" : "idle"}
              />
              <NameTag name={inmate.name} />
            </group>
          ))}
        </Suspense>
      </group>
    );
}

function OfferingBox() {
    return (
      <group position={[0, 0, -2.6]}>
        <mesh position={[0, 0.65, 0]} castShadow>
          <boxGeometry args={[1.8, 1.2, 1.2]} />
          <meshStandardMaterial color="#75472d" roughness={0.8} />
        </mesh>
        <mesh position={[0, 1.28, 0]}>
          <boxGeometry args={[1.9, 0.12, 1.3]} />
          <meshStandardMaterial color="#c39451" metalness={0.35} />
        </mesh>
        <mesh position={[0, 1.35, 0]}>
          <boxGeometry args={[0.65, 0.03, 0.12]} />
          <meshStandardMaterial color="#302a25" />
        </mesh>
        <Html position={[0, 2.2, 0]} center>
          <span className="whitespace-nowrap rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-[#3b342b] shadow">
            Offering box
          </span>
        </Html>
      </group>
    );
}

const BUILDING_STAFF: Record<string, Array<{
    name: string;
    position: [number, number, number, number];
    shirt: string;
    action: "idle" | "work" | "sit";
}>> = {
    bank: [
      { name: "Amina · Teller", position: [-5, 0, -6.7, 0], shirt: "#28776e", action: "work" },
      { name: "Tunde · Teller", position: [0, 0, -6.7, 0], shirt: "#355c6c", action: "work" },
      { name: "Bisi · Teller", position: [5, 0, -6.7, 0], shirt: "#b7793f", action: "work" },
    ],
    "state-cid": [
      { name: "Officer Akande", position: [5.5, 0, -6.5, 0], shirt: "#243c67", action: "idle" },
      { name: "Desk Sergeant", position: [-9.5, 0.45, 4, Math.PI / 2], shirt: "#243c67", action: "sit" },
    ],
    "federal-high-court": [
      { name: "Justice Adeyemi", position: [0, 0, -6.7, 0], shirt: "#342f35", action: "idle" },
      { name: "Counsel A", position: [-8, 0, -5.8, 0], shirt: "#183e63", action: "work" },
      { name: "Counsel B", position: [8, 0, -5.8, 0], shirt: "#5b3e31", action: "work" },
    ],
    church: [
      { name: "Pastor Olumide", position: [0, 0, -6.8, 0], shirt: "#754536", action: "idle" },
      { name: "Church Usher", position: [8, 0, -5.5, 0], shirt: "#47765c", action: "idle" },
    ],
};

function BuildingStaff({ buildingId }: { buildingId: string }) {
    const staff = BUILDING_STAFF[buildingId] ?? [];
    if (!staff.length) return null;

    return (
      <Suspense fallback={null}>
        {staff.map((person) => {
          const [x, y, z, ry] = person.position;

          return (
            <group key={person.name} position={[x, y, z]} rotation={[0, ry || 0, 0]}>
              <CharacterModel
                appearance={{ ...DEFAULT_CHARACTER_APPEARANCE, shirt: person.shirt }}
                targetHeight={PERSON_HEIGHT}
                action={person.action}
              />
              <NameTag name={person.name} />
            </group>
          );
        })}
      </Suspense>
    );
}

const ROOM_SEATS: Record<string, Array<{ x: number; z: number; ry?: number; label: string }>> = {
  bank: [-4, -2, 2, 4].map((x) => ({ x, z: 1, label: "Waiting chair" })),
  "state-cid": [
    { x: -7, z: -5.4, label: "Cell bench" }, 
    { x: 8.8, z: 4, label: "Waiting chair", ry: -Math.PI / 2 },],
  "federal-high-court": [-6, -2, 2, 6].map((x) => ({ x, z: 3, label: "Court bench" })),
  church: [-6, -2, 2, 6].map((x) => ({ x, z: 0, label: "Church pew" })),
};

/* ───────────── The room ───────────── */

function InteriorScene({
  config,
  buildingId,
  detained,
  players,
  bubbles,
  localId,
  remote,
  onChat,
  sitting,
  appearance,
  username,
  boxes,
  dancing,
  localRef,
  targetRef,
  onFloorTap,
  onSeatAt,
}: {
  config: InteriorConfig;
  buildingId: string;
  detained: boolean;
  onSeatAt: (pos: [number, number], action: "sit" | "idle") => void;
  players: RemotePlayer[];
  bubbles: Record<string, string>;
  localId: string;
  remote: MutableRefObject<Map<string, RemotePose>>;
  onChat: (player: RemotePlayer) => void;
  sitting: boolean;
  appearance: CharacterAppearance;
  username: string;
  boxes: Box[];
  dancing: boolean;
  localRef: MutableRefObject<RoomPose>;
  targetRef: MutableRefObject<{ x: number; z: number; ry?: number } | null>;
  onFloorTap: (x: number, z: number) => void;
}) {
  const isClub = buildingId === "zeus-club";
  const isMarket = buildingId === "market";

  return <>
    <color attach="background" args={[isClub ? "#0b0816" : isMarket ? "#87CEEB" : "#c8d7d2"]} />

    {isClub ? (
      <ClubLights />
    ) : (
      // Bright sunlight for the market and other buildings
      <>
        <ambientLight intensity={1.2} color="#ffffff" />
        <directionalLight position={[10, 15, 5]} intensity={2.5} color="#fff4d4" castShadow />
        <hemisphereLight args={["#87CEEB", "#6b4c3a", 0.8]} />
      </>
    )}

    {/* Tap the floor to walk there */}
    <mesh
      position={[0, -.15, 0]}
      receiveShadow
      onClick={(event) => onFloorTap(event.point.x, event.point.z)}
    >
      <boxGeometry args={[23, .3, 17]} />
      <meshStandardMaterial
        color={config.floor}
        roughness={isMarket ? 1 : isClub ? 0.55 : 0.9}
        metalness={isClub ? 0.1 : 0}
      />
    </mesh>
    {isClub && <DanceFloor />}

    {/* Walls (hidden for the open-air market) */}
    {!isMarket && (
      <>
        <mesh position={[0, 2.4, -8.3]} receiveShadow><boxGeometry args={[23, 5, .35]} /><meshStandardMaterial color={config.wall} roughness={.9} /></mesh>
        <mesh position={[-11.3, 2.4, 0]} receiveShadow><boxGeometry args={[.35, 5, 17]} /><meshStandardMaterial color={config.wall} roughness={.9} /></mesh>
        <mesh position={[11.3, 2.4, 0]} receiveShadow><boxGeometry args={[.35, 5, 17]} /><meshStandardMaterial color={config.wall} roughness={.9} /></mesh>
        <mesh position={[0, 4.85, -8.1]}><boxGeometry args={[22.5, .15, .25]} /><meshStandardMaterial color={config.accent} /></mesh>
      </>
    )}

    {config.fixtures.map((fixture, index) => <FixtureModel key={`${fixture.kind}-${index}`} fixture={fixture} />)}
    {buildingId === "state-cid" && <DetentionCell />}
    {buildingId === "state-cid" && (
      <Suspense fallback={null}>
        {/* Custom Lower Counter */}
        <group position={[4, 0, -5]}>
          {/* Lowered the height from 2.2 to 1.4 so characters can see over it */}
          <mesh position={[0, 0.7, 0]}>
            <boxGeometry args={[5.5, 1.4, 1.5]} />
            <meshStandardMaterial color="#344b67" />
          </mesh>
          {/* Countertop */}
          <mesh position={[0, 1.45, 0]}>
            <boxGeometry args={[5.7, 0.1, 1.7]} />
            <meshStandardMaterial color="#e0c9a2" />
          </mesh>
        </group>

        {/* Custom Office Desk GLB */}
        {/* Make sure "office-desk.glb" is in your public/models folder! */}
        <LoungeModel 
          url="/models/office_desk.glb" 
          position={[-9, 0, 4]} 
          rotation={-Math.PI / 25} 
          maxSize={[4, 2, 3]} 
        />

        <LoungeModel 
          url="/models/bench.glb" 
          position={[9, 0, 4]} 
          rotation={-Math.PI /2} 
          maxSize={[4, 2, 2]} 
        />
      </Suspense>
    )}
    {buildingId === "bank" && (
      <Suspense fallback={null}>
        {/* Left Counter */}
        <group position={[-5, 0, -5]}>
          <mesh position={[0, 0.7, 0]}>
            <boxGeometry args={[3, 1.4, 1.5]} />
            <meshStandardMaterial color="#2d4a5c" />
          </mesh>
          <mesh position={[0, 1.45, 0]}>
            <boxGeometry args={[3.2, 0.1, 1.7]} />
            <meshStandardMaterial color="#e0c9a2" />
          </mesh>
        </group>

        {/* Middle Counter */}
        <group position={[0, 0, -5]}>
          <mesh position={[0, 0.7, 0]}>
            <boxGeometry args={[3, 1.4, 1.5]} />
            <meshStandardMaterial color="#2d4a5c" />
          </mesh>
          <mesh position={[0, 1.45, 0]}>
            <boxGeometry args={[3.2, 0.1, 1.7]} />
            <meshStandardMaterial color="#e0c9a2" />
          </mesh>
        </group>

        {/* Right Counter */}
        <group position={[5, 0, -5]}>
          <mesh position={[0, 0.7, 0]}>
            <boxGeometry args={[3, 1.4, 1.5]} />
            <meshStandardMaterial color="#2d4a5c" />
          </mesh>
          <mesh position={[0, 1.45, 0]}>
            <boxGeometry args={[3.2, 0.1, 1.7]} />
            <meshStandardMaterial color="#e0c9a2" />
          </mesh>
        </group>

        {/* Bank Bench */}
        <LoungeModel 
          url="/models/bench.glb" 
          position={[0, 0, 2]} 
          rotation={0} // 0 means facing the camera (towards the counters)
          maxSize={[6, 2, 2]} 
        />
      </Suspense>
    )}
    {buildingId === "church" && <OfferingBox />}
    <BuildingStaff buildingId={buildingId} />
    {(ROOM_SEATS[buildingId] ?? []).map((seat) => (
      <mesh
        key={`${seat.label}-${seat.x}-${seat.z}`}
        position={[seat.x, 0.8, seat.z]}
        rotation={[0, seat.ry || 0, 0]}
        onClick={(event) => {
          event.stopPropagation();
          onSeatAt([seat.x, seat.z + 1], "sit");
        }}
      >
        <boxGeometry args={[1.8, 1.6, 1.8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    ))}
    {LOUNGE_BUILDINGS.has(buildingId) && (
      <Suspense fallback={null}>
        {/* Bar at the back */}
        <LoungeModel url="/models/bar.glb" position={[0, 0, -6.3]} maxSize={[6, 4, 4]} />

        {/* 4 duplicated lounge sets */}
        {[
          { pos: [-5.8, 0, 4] as [number, number, number], rot: 1.5 },
          { pos: [6, 0, 4] as [number, number, number], rot: -1.5 },
          { pos: [-5.8, 0, -3] as [number, number, number], rot: 0.9 },
          { pos: [6, 0, -3] as [number, number, number], rot: -0.9 },
        ].map((set, i) => (
          <group key={i}>
            <LoungeModel
              url="/models/lounge.glb"
              position={set.pos}
              rotation={set.rot}
              maxSize={[7, 3, 4]}
            />
            {/* <mesh position={[5.7, 1, 6.5]}> 
              <boxGeometry args={[1, 1, 1]} />
              <meshBasicMaterial color="red" />
            </mesh> */}
            <LoungeGuests
              buildingId={buildingId}
              position={set.pos}
              rotation={set.rot}
              index={i}
            />
          </group>
        ))}
      </Suspense>
    )}
    {isClub && <ZeusClubProps />}
    {isMarket && <MarketCrowd />}
    {buildingId === "palace" && <PalaceActivity />}

    <Suspense fallback={null}>
      <LocalPlayer
        appearance={appearance}
        username={username}
        bubble={bubbles[localId]}
        boxes={boxes}
        dancing={dancing}
        sitting={sitting}
        confined={detained}
        localRef={localRef}
        targetRef={targetRef}
      />
    </Suspense>
    <RemotePlayers players={players} bubbles={bubbles} remote={remote} onChat={onChat} />
  </>;
}

export default function BuildingInterior({
  buildingId,
  buildingName,
  appearance = DEFAULT_CHARACTER_APPEARANCE,
  onExit,
  onOpenPhone,
  onCrimeTravel,
}: {
  buildingId: string;
  buildingName: string;
  appearance?: CharacterAppearance;
  onExit: () => void;
  onCrimeTravel: (buildingId: string) => void;
  /** Called after a player is tapped so the phone opens on their chat */
  onOpenPhone?: () => void;
}) {
  const config = INTERIORS[buildingId] ?? DEFAULT_INTERIOR;
  const venue = isVenue(buildingId);
  const crimeBuilding = ["bank", "state-cid", "federal-high-court", "church"].includes(buildingId);
  const { userId, username, players, openThread } = useMultiplayer();
  const here = useMemo(
    () => players.filter((player) => player.place === buildingId),
    [players, buildingId]
  );

  const cash = useGameStore((state) => state.cash);
  const applyServerBalance = useGameStore((state) => state.applyServerBalance);

  const [crimeState, setCrimeState] = useState<CrimeResult | null>(null);
  const [crimeNotice, setCrimeNotice] = useState<string | null>(null);
  const [crimeLoading, setCrimeLoading] = useState(crimeBuilding);
  const [crimeBusy, setCrimeBusy] = useState(false);
  const [crimeLoadFailed, setCrimeLoadFailed] = useState(false);
  const [crimePanelOpen, setCrimePanelOpen] = useState(true);
  const [crimeRetry, setCrimeRetry] = useState(0);
  const [dancing, setDancing] = useState(false);
  const [sitting, setSitting] = useState(false);
  const [bubbles, setBubbles] = useState<Record<string, string>>({});
  const [spotNotice, setSpotNotice] = useState<string | null>(null);
  const bubbleTimers = useRef(new Map<string, number>());
  const localRef = useRef<RoomPose>({ x: SPAWN_X, z: SPAWN_Z, ry: 0, action: "idle" });
  const targetRef = useRef<{ x: number; z: number; ry?: number } | null>(null);
  const boxes = useMemo(() => buildObstacles(buildingId, config.fixtures), [buildingId, config]);

  const fx = useVenueFx(buildingName);
  const pushFx = fx.push;
  const drops = useMoneyDrops();
  const { add: addDrop, remove: removeDrop } = drops;

  useEffect(() => {
    const timers = bubbleTimers.current;
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, []);

  useEffect(() => {
    if (!crimeBuilding) return;
    let active = true;
    void getCrimeState()
      .then((result) => {
        if (!active) return;
        if (!result.ok) {
          setCrimeNotice(result.reason);
          setCrimeLoadFailed(true);
          return;
        }
        setCrimeLoadFailed(false);
        applyServerBalance(result.balance, result.version);
        setCrimeState(result);
        if (result.status === "station" && buildingId !== "state-cid") {
          onCrimeTravel("state-cid");
        } else if (result.status === "court" && buildingId !== "federal-high-court") {
          onCrimeTravel("federal-high-court");
        }
      })
      .catch((error: unknown) => {
        console.error("[BuildingInterior] Failed to load crime state:", error);
        if (active) {
          setCrimeNotice("Could not load your police record. Try again.");
          setCrimeLoadFailed(true);
        }
      })
      .finally(() => {
        if (active) setCrimeLoading(false);
      });
    return () => {
      active = false;
    };
  }, [applyServerBalance, buildingId, crimeBuilding, crimeRetry, onCrimeTravel]);

  const showBubble = useCallback((id: string, emoji: string) => {
    setBubbles((current) => ({ ...current, [id]: emoji }));
    const timers = bubbleTimers.current;
    const old = timers.get(id);
    if (old) window.clearTimeout(old);
    timers.set(
      id,
      window.setTimeout(() => {
        setBubbles((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        });
        timers.delete(id);
      }, 2600),
    );
  }, []);

  // Reactions are free and only cosmetic, so they travel over the room channel
  const handleRoomEvent = useCallback(
    (event: RoomEvent) => {
      const reaction = REACTIONS.find((item) => item.id === event.r);
      if (reaction) showBubble(event.u, reaction.emoji);
    },
    [showBubble],
  );

  const { remote, sendEvent } = useRoomSync(buildingId, userId, localRef, handleRoomEvent);

  // Purchases and sprayed notes come from the database, so nobody can fake them
  useVenueRealtime(venue ? buildingId : null, {
    onEvent: (row: VenueEventRow) => {
      if (row.user_id === userId) return; // you already saw your own
      const action = findAction(row.action_id, buildingId);
      if (action) pushFx(action, row.username);
    },
    onDrop: (row: MoneyDropRow) => addDrop(row, row.sprayer_id === userId),
    onDropClaimed: (id: string) => removeDrop(id),
  });

  const handleFloorTap = useCallback((x: number, z: number) => {
    targetRef.current = { x, z };
    setDancing(false);
    setSitting(false);
  }, []);

  const handleSeatAt = useCallback((pos: [number, number], action: "sit" | "idle", ry?: number) => {
    targetRef.current = { x: pos[0], z: pos[1], ry };
    setDancing(false);
    setSitting(action === "sit");
  }, []);

  const handleBuy = useCallback(
    async (action: VenueAction): Promise<BuyResult> => {
      const result = await venueBuy(buildingId, action.id);
      if (!result.ok) return { ok: false, reason: result.reason };

      applyServerBalance(result.balance, result.version);
      pushFx(action, username || "You");

      // Notes nobody picks up come back to you after about 30 seconds
      if (action.kind === "spray") {
        window.setTimeout(() => void useGameStore.getState().syncWallet(), 32_000);
      }
      return { ok: true };
    },
    [applyServerBalance, buildingId, pushFx, username],
  );

  const handleCrimeAction = useCallback(async (action: CrimeAction) => {
    setCrimeBusy(true);
    setCrimeNotice(null);
    try {
      const result = await performCrimeAction(action);
      if (!result.ok) {
        setCrimeNotice(result.reason);
        return;
      }

      applyServerBalance(result.balance, result.version);
      setCrimeState(result);
      if (result.outcome === "loot") {
        setCrimeNotice(`You got ${formatNaira(result.loot)} and slipped away.`);
      } else if (result.outcome === "offering") {
        setCrimeNotice(`You took ${formatNaira(result.loot || 50000)} from the offering box.`);
      } else if (result.outcome === "arrested") {
        setCrimeNotice(
          result.status === "station"
            ? "You were arrested and taken to State CID."
            : "You were arrested and taken to Federal High Court.",
        );
        onCrimeTravel(result.status === "station" ? "state-cid" : "federal-high-court");
      } else if (result.outcome === "released") {
        setCrimeNotice("You are free to leave.");
      }
    } catch (error: unknown) {
      console.error("[BuildingInterior] Crime action failed:", error);
      setCrimeNotice("That action failed. Please try again.");
    } finally {
      setCrimeBusy(false);
    }
  }, [applyServerBalance, onCrimeTravel]);

  const handleReact = useCallback(
    (reactionId: string) => {
      const reaction = REACTIONS.find((item) => item.id === reactionId);
      if (!reaction) return;
      showBubble(userId, reaction.emoji);
      sendEvent({ t: "react", u: userId, r: reaction.id });
    },
    [sendEvent, showBubble, userId],
  );

  const handleSpot = useCallback((spot: VenueSpot) => {
    const allPlayers = [...here, { userId }];
    
    const isOccupied = (sx: number, sz: number) => {
      return allPlayers.some((p) => {
        const pose = p.userId === userId ? localRef.current : remote.current.get(p.userId);
        if (!pose) return false;
        return Math.hypot(pose.x - sx, pose.z - sz) < 1.5 && pose.action === "sit";
      });
    };

    if (spot.label === "Bar") {
      const freeStool = BAR_STOOLS.find((s) => !isOccupied(s.x, s.z));
      if (!freeStool) {
        setSpotNotice("All bar stools are taken!");
        setTimeout(() => setSpotNotice(null), 3000);
        return;
      }
      targetRef.current = { x: freeStool.x, z: freeStool.z };
      setDancing(false);
      setSitting(true);
    } 
    else if (spot.label === "Lounge seat") {
      const freeSeat = LOUNGE_SEATS.find((s) => !isOccupied(s.x, s.z));
      if (!freeSeat) {
        setSpotNotice("All lounge seats are taken!");
        setTimeout(() => setSpotNotice(null), 3000);
        return;
      }
      handleSeatAt([freeSeat.x, freeSeat.z], "sit", freeSeat.ry);  
      setDancing(false);
      setSitting(true);
    } 
    else {
      targetRef.current = { x: spot.x, z: spot.z };
      setDancing(false);
      setSitting(false);
    }
  }, [here, userId, remote, localRef]);

  function chatWith(player: RemotePlayer) {
    openThread({ userId: player.userId, username: player.username });
    onOpenPhone?.();
  }

  return <div className="absolute inset-0 z-20 overflow-hidden bg-[#c8d7d2]">
    <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 10, 19], fov: 48, near: .1, far: 100 }} gl={{ antialias: true }}>
      <OrbitControls makeDefault enablePan={false} enableRotate enableZoom minDistance={12} maxDistance={27} maxPolarAngle={Math.PI / 2.05} target={[0, 1.5, 0]} />
      <InteriorScene
        key={`${buildingId}-${crimeState?.status ?? "loading"}`}
        config={config}
        buildingId={buildingId}
        detained={buildingId === "state-cid" && crimeState?.status === "station"}
        onSeatAt={handleSeatAt}
        players={here}
        bubbles={bubbles}
        localId={userId}
        remote={remote}
        onChat={chatWith}
        sitting={sitting}
        appearance={appearance}
        username={username || "You"}
        boxes={boxes}
        dancing={dancing}
        localRef={localRef}
        targetRef={targetRef}
        onFloorTap={handleFloorTap}
      />
    </Canvas>

    {venue && <VenueFxLayer fx={fx} />}
    {venue && <MoneyDropsLayer drops={drops} />}

    {spotNotice && (
      <div className="pointer-events-none absolute bottom-36 left-1/2 z-50 -translate-x-1/2 rounded-full bg-black/80 px-4 py-2 text-sm font-bold text-white shadow-lg backdrop-blur">
        {spotNotice}
      </div>
    )}

    <div className="pointer-events-none absolute inset-0">
      <div className="pointer-events-auto absolute left-3 top-[calc(env(safe-area-inset-top)+7rem)] flex max-w-[calc(100%-1.5rem)] items-center gap-2 sm:left-4">
        <button type="button" onClick={onExit} aria-label="Return to map" title="Return to map" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/90 bg-white/95 text-[#263d31] shadow-lg transition-transform hover:scale-105">
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 max-w-[calc(100vw-5rem)] rounded-md border border-white/50 bg-white/80 px-3 py-2 shadow-lg backdrop-blur">
          <p className="truncate text-[9px] font-bold uppercase tracking-[0.12em] text-[#728274]">
            {config.subtitle}{here.length > 0 ? ` · ${here.length} here` : ""}
          </p>
          <h1 className="truncate text-sm font-extrabold text-[#263d31]">{buildingName}</h1>
        </div>
      </div>

      {venue ? (
        <VenuePanel
          venueId={buildingId}
          venueName={buildingName}
          cash={cash}
          here={here}
          dancing={dancing}
          onToggleDance={() => setDancing((current) => !current)}
          onReact={handleReact}
          onBuy={handleBuy}
          onWalkToSpot={handleSpot}
          onChat={chatWith}
        />
      ) : !crimeBuilding ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-44 flex flex-col items-center gap-2 px-3">
          <p className="rounded-full bg-black/45 px-3 py-1 text-[10px] font-semibold text-white backdrop-blur">
            Tap the floor to walk
          </p>
          <button
            type="button"
            onClick={() => setDancing((current) => !current)}
            aria-pressed={dancing}
            className={`pointer-events-auto flex h-11 items-center gap-2 rounded-full border px-5 text-[13px] font-extrabold shadow-lg backdrop-blur transition-colors ${
              dancing
                ? "border-[#f04f9b] bg-[#f04f9b] text-white"
                : "border-white/80 bg-white/95 text-[#263d31]"
            }`}
          >
            <span aria-hidden>💃</span>
            {dancing ? "Stop dancing" : "Dance"}
          </button>
        </div>
      ) : null}

      {crimeBuilding && !crimePanelOpen && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] flex flex-col items-center gap-2 px-3">
          <p className="rounded-full bg-black/45 px-3 py-1 text-[10px] font-semibold text-white backdrop-blur">
            Tap the floor or a seat to move around
          </p>
          <button
            type="button"
            onClick={() => setCrimePanelOpen(true)}
            className="pointer-events-auto flex h-11 items-center gap-2 rounded-full border border-white/15 bg-[#1a2a30]/95 px-5 text-[13px] font-extrabold text-white shadow-lg backdrop-blur"
          >
            <span>{buildingId === "bank" ? "🏦" : buildingId === "state-cid" ? "🚓" : buildingId === "federal-high-court" ? "⚖️" : "⛪"}</span>
            {crimeLoadFailed ? "Retry connection" : "Open venue actions"}
          </button>
        </div>
      )}

      {crimeBuilding && crimePanelOpen && (
        <div className="pointer-events-auto absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-40 flex max-h-[80vh] flex-col overflow-hidden rounded-[2rem] bg-[#1a2a30]/95 text-white shadow-[0_10px_40px_rgba(0,0,0,0.8)] backdrop-blur-2xl border border-white/10">
          
          {/* Header */}
          <div className="flex items-start justify-between px-5 pt-5 pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-2xl">
                {buildingId === "bank" && "🏦"}
                {buildingId === "state-cid" && "🚓"}
                {buildingId === "federal-high-court" && "⚖️"}
                {buildingId === "church" && "⛪"}
              </div>
              <div>
                <h2 className="text-xl font-extrabold tracking-tight">{buildingName}</h2>
                <p className="text-xs text-white/70">
                  {buildingId === "bank" && "Safe & Secure Banking"}
                  {buildingId === "state-cid" && "State CID Holding Station"}
                  {buildingId === "federal-high-court" && "Federal High Court"}
                  {buildingId === "church" && "Offering & Donations"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCrimePanelOpen(false)}
                aria-label="Collapse venue actions"
                className="rounded-full bg-white/10 p-2 text-white/80 hover:bg-white/20"
              >
                <ChevronDown size={18} />
              </button>
              <button onClick={onExit} aria-label="Return to map" className="rounded-full bg-white/10 p-2 text-white/80 hover:bg-white/20">
                <ArrowLeft size={16} />
              </button>
            </div>
          </div>

          {/* Status Message */}
          <div className="px-5 pb-4">
            <div className="flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-4 py-3">
              <span className="text-xs font-medium text-white/80">
                {crimeNotice ??
                  (crimeLoading
                    ? "Checking your record…"
                    : crimeState?.status === "station"
                      ? `You are being held. Stolen: ${formatNaira(crimeState.stolenAmount)}.`
                      : crimeState?.status === "court"
                        ? `Your case is in court. Stolen: ${formatNaira(crimeState.stolenAmount)}.`
                        : "Choose an action below.")}
              </span>
            </div>
            {crimeLoadFailed && (
              <button
                type="button"
                disabled={crimeLoading}
                onClick={() => {
                  setCrimeLoading(true);
                  setCrimeLoadFailed(false);
                  setCrimeNotice(null);
                  setCrimeRetry((attempt) => attempt + 1);
                }}
                className="mt-2 rounded-full bg-white/10 px-4 py-2 text-xs font-bold hover:bg-white/15 disabled:opacity-50"
              >
                {crimeLoading ? "Connecting…" : "Retry"}
              </button>
            )}
          </div>

          {/* Action Cards */}
          <div className="flex flex-col gap-2 overflow-y-auto px-5 pb-4 scrollbar-hide">
            {buildingId === "bank" && crimeState?.status === "clear" && (
              <>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#bd783c] text-xl">💰</div>
                    <div>
                      <p className="text-sm font-bold">Rob the Bank</p>
                      <p className="text-[10px] text-white/50">40% chance of arrest</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={crimeLoading || crimeBusy}
                    onClick={() => void handleCrimeAction("bank_rob")}
                    className="rounded-full bg-[#bd783c] px-4 py-2 text-xs font-extrabold shadow-lg disabled:opacity-50"
                  >
                    Attempt
                  </button>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#6d5aa5] text-xl">💻</div>
                    <div>
                      <p className="text-sm font-bold">Hack the Bank</p>
                      <p className="text-[10px] text-white/50">Immediate arrest and court case</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={crimeLoading || crimeBusy}
                    onClick={() => void handleCrimeAction("bank_hack")}
                    className="rounded-full bg-[#6d5aa5] px-4 py-2 text-xs font-extrabold shadow-lg disabled:opacity-50"
                  >
                    Attempt
                  </button>
                </div>
              </>
            )}

            {buildingId === "church" && (
              <button
                type="button"
                disabled={crimeLoading || crimeBusy || crimeState?.status !== "clear" || crimeState?.offeringClaimed}
                onClick={() => void handleCrimeAction("church_offering")}
                className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#9b5442] text-xl">🕊️</div>
                  <div className="text-left">
                    <p className="text-sm font-bold">{crimeState?.offeringClaimed ? "Offering taken" : "Take Offering"}</p>
                    <p className="text-[10px] text-white/50">+₦50,000 · once only</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-white/70">Take</span>
              </button>
            )}

            {buildingId === "state-cid" && crimeState?.status === "station" && (
              <>
                <p className="rounded-xl bg-white/5 px-3 py-2 text-xs text-white/70">
                  Case amount: {formatNaira(crimeState.stolenAmount)} · Bail and damages: ₦150,000
                </p>
                <button
                  type="button"
                  disabled={crimeLoading || crimeBusy || crimeState.stolenAmount >= 100000 || cash < 150000}
                  onClick={() => void handleCrimeAction("bail")}
                  className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 disabled:opacity-50"
                >
                  <span className="text-left text-sm font-bold">
                    {crimeState.stolenAmount >= 100000 ? "Bail unavailable for this amount" : "Pay bail and damages"}
                    {crimeState.stolenAmount < 100000 && cash < 150000 && <span className="block text-[10px] font-medium text-white/50">Not enough cash</span>}
                  </span>
                  <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold">₦150,000</span>
                </button>
              </>
            )}

            {buildingId === "federal-high-court" && crimeState?.status === "court" && (
              <>
                <p className="rounded-xl bg-white/5 px-3 py-2 text-xs text-white/70">
                  Case amount: {formatNaira(crimeState.stolenAmount)}
                </p>
                <button
                  type="button"
                  disabled={crimeLoading || crimeBusy || cash < 120000}
                  onClick={() => void handleCrimeAction("court_lawyer")}
                  className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 disabled:opacity-50"
                >
                  <span className="text-left">
                    <span className="block text-sm font-bold">Hire a Lawyer</span>
                    {cash < 120000 && <span className="text-[10px] text-white/50">Not enough cash</span>}
                  </span>
                  <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold">₦120,000</span>
                </button>

                <button
                  type="button"
                  disabled={crimeLoading || crimeBusy || cash < crimeState.stolenAmount}
                  onClick={() => void handleCrimeAction("court_defend")}
                  className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 disabled:opacity-50"
                >
                  <span className="text-left">
                    <span className="block text-sm font-bold">Defend Yourself</span>
                    <span className="text-[10px] text-white/50">Forfeits the stolen amount</span>
                  </span>
                  <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold">
                    {formatNaira(crimeState.stolenAmount)}
                  </span>
                </button>
              </>
            )}
          </div>

          {crimeState && (
            <div className="px-5 pb-4">
              <button
                type="button"
                disabled={crimeBusy || crimeLoading}
                onClick={() => {
                  const seat = buildingId === "state-cid" && crimeState.status === "station"
                    ? ROOM_SEATS["state-cid"][0]
                    : ROOM_SEATS[buildingId]?.find((entry) => entry.label !== "Cell bench");
                  if (seat) handleSeatAt([seat.x, seat.z], "sit", seat.ry);
                }}
                className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-bold text-white/85 hover:bg-white/10 disabled:opacity-40"
              >
                🪑 {buildingId === "state-cid" && crimeState.status === "station"
                  ? "Sit on the cell bench"
                  : `Sit in the ${buildingId === "bank" ? "waiting area" : buildingId === "federal-high-court" ? "gallery" : buildingId === "church" ? "pew" : "waiting area"}`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  </div>;
}