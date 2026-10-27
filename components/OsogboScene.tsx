"use client";

import { Html, OrbitControls, MapControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Group, InstancedMesh } from "three";
import { getGameClock } from "@/lib/time";
import { useNow } from "@/hooks/useNow";
import { useGameStore } from "@/store/gameStore";
import {
  CharacterAppearance,
  DEFAULT_CHARACTER_APPEARANCE,
  buildAvatarUrl,
} from "@/store/characterAppearance";
import CharacterModel from "@/components/game/CharacterModel";

type Point = { x: number; y: number };
type Home = Point & { floors: number; roof: string };
type Building = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  height: number;
  roof: string;
  wall: string;
  icon: string;
  kind?: "market" | "tower" | "stadium" | "lounge" | "openbar" | "flyover";
};
type BillboardData = {
  x: number;
  y: number;
  width: number;
  title: string;
  subtitle: string;
  color: string;
};
type TrafficVehicleProps = {
  kind: "sedan" | "taxi" | "van" | "bike";
  color: string;
  speed: number;
  start: number;
  lane: number;
  road: "upper" | "lower" | "vertical";
};

const WORLD_WIDTH = 2400;
const WORLD_HEIGHT = 1600;
const GROVE_CENTER = { x: 672, y: 1040 };
const MIN_BUILDING_GAP = 90;
const LABEL_FLIP_X = WORLD_WIDTH * 0.7;
const PEDESTRIAN_SCALE = 0.45;
const PLAYER_SCALE = 0.5;

const UPPER_ROAD_TILT = -0.035;
const LOWER_ROAD_TILT = 0.04;
const VERTICAL_ROAD_X = 822;
const ROAD_SURFACE = 4;

const FLYOVER_X = VERTICAL_ROAD_X;
const FLYOVER_Z = 570 - (VERTICAL_ROAD_X / Math.cos(LOWER_ROAD_TILT)) * Math.sin(LOWER_ROAD_TILT);
const FLYOVER_WIDTH = 38;
const FLYOVER_FLAT_HALF = 70;
const FLYOVER_RAMP = 120;
const FLYOVER_TOP = 42;
const FLYOVER_RISE = FLYOVER_TOP - ROAD_SURFACE;

const OLAIYA_X = VERTICAL_ROAD_X;
const OLAIYA_ALONG = VERTICAL_ROAD_X / Math.cos(UPPER_ROAD_TILT);
const OLAIYA_Z = -370 - OLAIYA_ALONG * Math.sin(UPPER_ROAD_TILT);
const OLAIYA_WIDTH = 60;

function rampHeight(distance: number) {
  if (distance <= FLYOVER_FLAT_HALF) return FLYOVER_TOP;
  if (distance >= FLYOVER_FLAT_HALF + FLYOVER_RAMP) return ROAD_SURFACE;
  const amount = (distance - FLYOVER_FLAT_HALF) / FLYOVER_RAMP;
  return FLYOVER_TOP - FLYOVER_RISE * amount;
}

function rampSlope(offset: number) {
  const distance = Math.abs(offset);
  if (distance <= FLYOVER_FLAT_HALF || distance >= FLYOVER_FLAT_HALF + FLYOVER_RAMP) return 0;
  return -Math.sign(offset) * (FLYOVER_RISE / FLYOVER_RAMP);
}

function flyoverHeight(z: number) {
  return rampHeight(Math.abs(z - FLYOVER_Z));
}
function flyoverSlope(z: number) {
  return rampSlope(z - FLYOVER_Z);
}
function upperFlyoverHeight(along: number) {
  return rampHeight(Math.abs(along - OLAIYA_ALONG));
}
function upperFlyoverSlope(along: number) {
  return rampSlope(along - OLAIYA_ALONG);
}

const RIVER_ROUTE: Point[] = [
  { x: 540, y: -100 }, { x: 620, y: 200 }, { x: 540, y: 470 },
  { x: 635, y: 720 }, { x: 570, y: 920 }, { x: 535, y: 1030 },
  { x: 600, y: 1150 }, { x: 760, y: 1290 }, { x: 920, y: 1360 },
  { x: 1080, y: 1430 }, { x: 1160, y: 1885 },
];

function riverCenterAt(y: number) {
  for (let index = 1; index < RIVER_ROUTE.length; index += 1) {
    const start = RIVER_ROUTE[index - 1];
    const end = RIVER_ROUTE[index];
    if (y <= end.y) {
      const amount = (y - start.y) / (end.y - start.y);
      return start.x + (end.x - start.x) * amount;
    }
  }
  return RIVER_ROUTE[RIVER_ROUTE.length - 1].x;
}

function clearsRiver(x: number, y: number, width: number, depth: number, margin = 20) {
  for (let sampleY = y; sampleY <= y + depth; sampleY += 16) {
    const riverX = riverCenterAt(sampleY);
    if (x < riverX + 34 + margin && x + width > riverX - 34 - margin) return false;
  }
  return true;
}

function worldPosition(x: number, y: number, height = 0): [number, number, number] {
  return [x - WORLD_WIDTH / 2, height, y - WORLD_HEIGHT / 2];
}

const RIVER_BRIDGES = [
  { y: 430, rotation: UPPER_ROAD_TILT },
  { y: 1370, rotation: LOWER_ROAD_TILT },
].map(({ y, rotation }) => ({
  position: worldPosition(riverCenterAt(y), y),
  rotation,
}));

const LAMPS = (() => {
  const roads = [
    { baseZ: -370, tilt: UPPER_ROAD_TILT, halfWidth: 49 },
    { baseZ: 570, tilt: LOWER_ROAD_TILT, halfWidth: 49 },
  ];
  const keepAway = [VERTICAL_ROAD_X, ...RIVER_BRIDGES.map((bridge) => bridge.position[0])];
  const lamps: Point[] = [];

  for (const road of roads) {
    for (let along = -1100; along <= 1100; along += 220) {
      for (const side of [-1, 1]) {
        const lateral = side * road.halfWidth;
        const x = along * Math.cos(road.tilt) + lateral * Math.sin(road.tilt);
        const z = road.baseZ - along * Math.sin(road.tilt) + lateral * Math.cos(road.tilt);
        if (keepAway.some((away) => Math.abs(x - away) < 90)) continue;
        lamps.push({ x, y: z });
      }
    }
  }
  return lamps;
})();

const HORIZONTAL_ROADS = [
  { start: 375, end: 485 },
  { start: 1320, end: 1450 },
];
const VERTICAL_ROADS = [{ start: 2000, end: 2044, top: 60, bottom: 1540 }];

function isOffRoad(x: number, y: number, width: number, depth: number, clearance = 0) {
  const insideHorizontalRoad = HORIZONTAL_ROADS.some((road) =>
    y < road.end + clearance && y + depth > road.start - clearance
  );
  const insideVerticalRoad = VERTICAL_ROADS.some((road) =>
    x < road.end + clearance && x + width > road.start - clearance &&
    y < road.bottom + clearance && y + depth > road.top - clearance
  );
  return !insideHorizontalRoad && !insideVerticalRoad;
}

function clearsGrove(x: number, y: number, width: number, depth: number) {
  return Math.hypot(x + width / 2 - GROVE_CENTER.x, y + depth / 2 - GROVE_CENTER.y) > 300;
}

const HOME_PLOTS: Home[] = Array.from({ length: 144 }, (_, index) => ({
  x: 120 + (index % 12) * 172,
  y: 70 + Math.floor(index / 12) * 110,
  floors: index % 17 === 0 ? 3 : index % 5 === 0 ? 2 : 1,
  roof: ["#d08a57", "#b9764e", "#d5aa62", "#a8624c"][index % 4],
})).filter((home) => {
  return isOffRoad(home.x, home.y, 108, 42, 18) &&
    Math.abs(home.x + 54 - riverCenterAt(home.y + 21)) > 82 &&
    clearsGrove(home.x, home.y, 108, 42);
}).concat(Array.from({ length: 12 }, (_, index) => ({
  x: 2280,
  y: 600 + index * 78,
  floors: index % 9 === 0 ? 3 : index % 4 === 0 ? 2 : 1,
  roof: ["#bd7b50", "#d19a5f", "#a75e49", "#c48b59"][index % 4],
})).filter((home) => isOffRoad(home.x, home.y, 108, 42, 18) &&
  Math.abs(home.x + 54 - riverCenterAt(home.y + 21)) > 82 &&
  clearsGrove(home.x, home.y, 108, 42)));

const BUILDINGS: Building[] = [
  { id: "uniosun", name: "UNIOSUN Osogbo Campus", x: 220, y: 150, width: 120, depth: 92, height: 52, roof: "#a64b42", wall: "#d6c79e", icon: "🎓" },
  { id: "stadium", name: "Osogbo City Stadium", x: 960, y: 50, width: 280, depth: 280, height: 28, roof: "#47704c", wall: "#d4c69b", icon: "🏟️", kind: "stadium" },
  { id: "home", name: "Home", x: 1560, y: 140, width: 145, depth: 88, height: 58, roof: "#934c38", wall: "#d9bd91", icon: "🏠" },
  { id: "hospital", name: "City Hospital", x: 2150, y: 140, width: 140, depth: 110, height: 66, roof: "#7b4038", wall: "#e0d6b8", icon: "🏥" },
  { id: "palace", name: "Ataoja Palace", x: 200, y: 700, width: 120, depth: 82, height: 55, roof: "#80623c", wall: "#dfcba4", icon: "🏛️" },
  { id: "market", name: "Oja Oba Market", x: 860, y: 680, width: 300, depth: 165, height: 76, roof: "#875a34", wall: "#d5b477", icon: "🧺", kind: "market" },
  { id: "adire-tower", name: "Nike's Gallery", x: 0, y: 700, width: 115, depth: 90, height: 145, roof: "#30485c", wall: "#72a2a7", icon: "🏙️", kind: "tower" },
  { id: "civic-tower", name: "Osun Civic Tower", x: 1560, y: 880, width: 118, depth: 96, height: 160, roof: "#596b79", wall: "#8bb7b5", icon: "🏢", kind: "tower" },
  { id: "bank-tower", name: "Oroki Heights", x: 2110, y: 790, width: 118, depth: 92, height: 132, roof: "#48515f", wall: "#94b2ad", icon: "🏬", kind: "tower" },
  { id: "grove-gate", name: "Osun Grove", x: 370, y: 1000, width: 110, depth: 78, height: 48, roof: "#47704c", wall: "#d4c69b", icon: "🌳" },
  { id: "bus-stop", name: "Osogbo central mosque", x: 160, y: 1160, width: 105, depth: 72, height: 40, roof: "#526a6d", wall: "#ded1ae", icon: "🛺" },
  { id: "shop1", name: "Local Shop", x: 1010, y: 1000, width: 125, depth: 90, height: 49, roof: "#4d6c70", wall: "#d4c59b", icon: "🛍️" },
  { id: "barber", name: "Fresh Cut", x: 940, y: 1190, width: 115, depth: 85, height: 44, roof: "#49676d", wall: "#d9c59b", icon: "✂️" },
  { id: "restaurant", name: "Alahja Alamala's Kitchen", x: 1350, y: 1070, width: 145, depth: 100, height: 56, roof: "#7b4631", wall: "#d8b982", icon: "🍲" },
  { id: "mall", name: "Osun Mall", x: 1760, y: 1060, width: 190, depth: 125, height: 76, roof: "#5d5a61", wall: "#cbc6b5", icon: "🛒" },
  { id: "garage", name: "Mechanic Garage", x: 2150, y: 1160, width: 150, depth: 100, height: 48, roof: "#62584c", wall: "#bda980", icon: "🛠️" },
  { id: "berrymist", name: "BerryMist Lounge", x: 665, y: 518, width: 115, depth: 85, height: 36, roof: "#d6336c", wall: "#3b2f48", icon: "🍹", kind: "openbar" },
  { id: "circle-lounge", name: "Circle Lounge", x: 1250, y: 625, width: 140, depth: 95, height: 40, roof: "#2fc4b2", wall: "#2f3d4a", icon: "🍸", kind: "openbar" },
  { id: "zeus-club", name: "Zeus Club", x: 1810, y: 600, width: 140, depth: 95, height: 56, roof: "#8b5cf6", wall: "#2b2740", icon: "🪩", kind: "lounge" },
  { id: "okefia", name: "Okefia Flyover", x: 2003, y: 1307, width: 38, depth: 60, height: 42, roof: "#6b6b6b", wall: "#9d9582", icon: "🌉", kind: "flyover" },
  { id: "olaiya", name: "Olaiya Flyover", x: 1992, y: 429, width: 60, depth: 60, height: 42, roof: "#6b6b6b", wall: "#9d9582", icon: "🌉", kind: "flyover" },
];

const BILLBOARDS: BillboardData[] = [
  { x: 300, y: 505, width: 250, title: "NIKE'S GALLERY", subtitle: "CRAFTED IN OSOGBO", color: "#28776e" },
  { x: 680, y: 50, width: 280, title: "OJA OBA", subtitle: "MARKET DAY", color: "#bc6345" },
  { x: 1210, y: 500, width: 270, title: "OSUN", subtitle: "HERITAGE WEEK", color: "#d89b3c" },
  { x: 1720, y: 500, width: 265, title: "OROKI", subtitle: "MADE IN OSOGBO", color: "#346f77" },
  { x: 2110, y: 505, width: 245, title: "CITY LIFE", subtitle: "FIND YOUR PLACE", color: "#9b5442" },
  { x: 400, y: 1270, width: 150, title: "Ads", subtitle: "FIND YOUR LiFE", color: "#9b5442" },
];

const HOME_BUILDING = BUILDINGS.find((building) => building.id === "home")!;

const PLACED_BUILDINGS = BUILDINGS.filter((building) =>
  clearsRiver(building.x, building.y, building.width, building.depth)
);

function overlapsBuilding(x: number, y: number, width: number, depth: number, building: Building, clearance = 36) {
  return x < building.x + building.width + clearance &&
    x + width > building.x - clearance &&
    y < building.y + building.depth + clearance &&
    y + depth > building.y - clearance;
}

function overlapsBillboard(x: number, y: number, width: number, depth: number, clearance = 30) {
  return BILLBOARDS.some((board) =>
    x < board.x + board.width + clearance &&
    x + width > board.x - clearance &&
    y < board.y + 50 + clearance &&
    y + depth > board.y - 20
  );
}

const HOMES = HOME_PLOTS.filter((home) =>
  isOffRoad(home.x, home.y, 108, 42, 10) &&
  clearsRiver(home.x, home.y, 108, 42) &&
  Math.abs(home.x + 54 - riverCenterAt(home.y + 21)) > 82 &&
  clearsGrove(home.x, home.y, 108, 42) &&
  !overlapsBillboard(home.x, home.y, 108, 42) &&
  !PLACED_BUILDINGS.some((building) => overlapsBuilding(home.x, home.y, 108, 42, building, 65))
);

const TREES: Point[] = [
  { x: 180, y: 180 }, { x: 720, y: 170 }, { x: 1130, y: 220 }, { x: 2070, y: 180 },
  { x: 190, y: 700 }, { x: 520, y: 770 }, { x: 1050, y: 380 }, { x: 1390, y: 470 },
  { x: 2150, y: 500 }, { x: 260, y: 1200 }, { x: 1190, y: 1270 }, { x: 2040, y: 1370 },
  { x: 2250, y: 900 }, { x: 1540, y: 780 },
].filter((tree) => isOffRoad(tree.x - 18, tree.y - 18, 36, 36, 8) &&
  clearsRiver(tree.x - 18, tree.y - 18, 36, 36) &&
  Math.abs(tree.x - riverCenterAt(tree.y)) > 88 &&
  clearsGrove(tree.x - 18, tree.y - 18, 36, 36) &&
  !overlapsBillboard(tree.x - 18, tree.y - 18, 36, 36) &&
  !PLACED_BUILDINGS.some((building) => overlapsBuilding(tree.x - 18, tree.y - 18, 36, 36, building, 42)));

function createRiverGeometry() {
  const curve = new THREE.CatmullRomCurve3(
    RIVER_ROUTE.map((point) => new THREE.Vector3(point.x - WORLD_WIDTH / 2, 1.1, point.y - WORLD_HEIGHT / 2)),
    false,
    "catmullrom",
    0.1
  );
  const points = curve.getPoints(220);
  const positions = new Float32Array(points.length * 2 * 3);
  const indices: number[] = [];

  points.forEach((point, index) => {
    const tangent = curve.getTangentAt(index / (points.length - 1));
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize().multiplyScalar(34);
    const left = point.clone().add(side);
    const right = point.clone().sub(side);
    positions.set([left.x, left.y, left.z, right.x, right.y, right.z], index * 6);
    if (index < points.length - 1) {
      const base = index * 2;
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createGrassTexture() {
  const size = 256;
  const pixels = new Uint8Array(size * size * 4);

  function noise(x: number, y: number, scale: number) {
    let value = (Math.floor(x / scale) * 374761393 + Math.floor(y / scale) * 668265263 + 1442695041) >>> 0;
    value = Math.imul(value ^ (value >>> 13), 1274126177) >>> 0;
    return value / 4294967295;
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const variation = (noise(x, y, 1) - 0.5) * 22 + (noise(x, y, 24) - 0.5) * 34;
      pixels[index] = Math.max(0, Math.min(255, 79 + variation * 0.72));
      pixels[index + 1] = Math.max(0, Math.min(255, 124 + variation));
      pixels[index + 2] = Math.max(0, Math.min(255, 58 + variation * 0.62));
      pixels[index + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(13, 9);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function createRoadTexture() {
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let value = (x * 374761393 + y * 668265263 + 1442695041) >>> 0;
      value = Math.imul(value ^ (value >>> 13), 1274126177) >>> 0;
      const grain = ((value / 4294967295) - 0.5) * 26;
      const index = (y * size + x) * 4;
      pixels[index] = 65 + grain;
      pixels[index + 1] = 68 + grain;
      pixels[index + 2] = 65 + grain;
      pixels[index + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(100, 6);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function islandPoint(angle: number, scale: number): [number, number] {
  const lobes = 1 + Math.sin(angle * 3 + 0.4) * 0.075 + Math.sin(angle * 5 - 0.9) * 0.035 + Math.cos(angle * 8 + 0.3) * 0.018;
  const radiusX = (WORLD_WIDTH / 2 + 170) * lobes * scale;
  const radiusZ = (WORLD_HEIGHT / 2 + 130) * lobes * scale;
  return [Math.cos(angle) * radiusX, Math.sin(angle) * radiusZ];
}

function createIslandGeometry(scale: number) {
  const shape = new THREE.Shape();
  const segments = 240;

  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    const [x, z] = islandPoint(angle, scale);
    if (index === 0) shape.moveTo(x, z);
    else shape.lineTo(x, z);
  }

  shape.closePath();
  return new THREE.ShapeGeometry(shape, 1);
}

function createIslandCliffGeometry() {
  const segments = 240;
  const layers = [
    { scale: 1.06, y: -2.8 },
    { scale: 1.08, y: -15 },
    { scale: 1.12, y: -31 },
    { scale: 1.16, y: -46 },
  ];
  const positions = new Float32Array(segments * layers.length * 3);
  const indices: number[] = [];

  layers.forEach((layer, layerIndex) => {
    for (let index = 0; index < segments; index += 1) {
      const angle = (index / segments) * Math.PI * 2;
      const [x, z] = islandPoint(angle, layer.scale);
      positions.set([x, layer.y, z], (layerIndex * segments + index) * 3);
    }
  });

  for (let layer = 0; layer < layers.length - 1; layer += 1) {
    for (let index = 0; index < segments; index += 1) {
      const next = (index + 1) % segments;
      const upper = layer * segments + index;
      const lower = (layer + 1) * segments + index;
      const upperNext = layer * segments + next;
      const lowerNext = (layer + 1) * segments + next;
      indices.push(upper, lower, upperNext, lower, lowerNext, upperNext);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createOceanTexture() {
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const wave = Math.sin((x + y * 0.45) * 0.24) * 4 + Math.cos((x - y) * 0.17) * 3;
      let noise = (x * 374761393 + y * 668265263 + 1442695041) >>> 0;
      noise = Math.imul(noise ^ (noise >>> 13), 1274126177) >>> 0;
      const grain = (noise / 4294967295 - 0.5) * 12;
      const index = (y * size + x) * 4;
      pixels[index] = 39 + wave + grain;
      pixels[index + 1] = 112 + wave + grain;
      pixels[index + 2] = 133 + wave + grain;
      pixels[index + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(80, 80);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function Road({
  length,
  width,
  position,
  rotation = 0,
  crossings = [],
  asphalt,
}: {
  length: number;
  width: number;
  position: [number, number, number];
  rotation?: number;
  crossings?: number[];
  asphalt: THREE.DataTexture;
}) {
  const sidewalkOffset = width / 2 + 4;
  const dashCount = Math.floor(length / 120);
  const sidewalkJoints = Math.floor(length / 80);

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.8, 0]} receiveShadow>
        <boxGeometry args={[length + 16, 2.4, width + 18]} /><meshStandardMaterial color="#ae9d7a" roughness={1} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[0, 2.55, side * sidewalkOffset]} receiveShadow>
            <boxGeometry args={[length + 12, 3, 8]} /><meshStandardMaterial color="#c7b994" roughness={0.95} />
          </mesh>
          <mesh position={[0, 4.12, side * width * 0.46]}>
            <boxGeometry args={[length - 12, 0.32, 1.8]} /><meshStandardMaterial color="#e1dcc6" roughness={0.72} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 2, 0]} receiveShadow>
        <boxGeometry args={[length, 4, width]} /><meshStandardMaterial map={asphalt} roughness={0.94} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, 4.16, side * 2.2]}>
          <boxGeometry args={[length - 18, 0.32, 1.6]} /><meshStandardMaterial color="#e0b94f" roughness={0.72} />
        </mesh>
      ))}
      {Array.from({ length: dashCount }, (_, index) => (
        <mesh key={`dash-${index}`} position={[index * 120 - length / 2 + 85, 4.14, 0]}>
          <boxGeometry args={[48, 0.28, 1.2]} /><meshStandardMaterial color="#e7e2d0" roughness={0.75} />
        </mesh>
      ))}
      {Array.from({ length: sidewalkJoints }, (_, index) => {
        const x = index * 80 - length / 2 + 40;
        return [-1, 1].map((side) => (
          <mesh key={`joint-${index}-${side}`} position={[x, 4.08, side * sidewalkOffset]}>
            <boxGeometry args={[0.8, 0.2, 7]} /><meshStandardMaterial color="#9f9378" roughness={1} />
          </mesh>
        ));
      })}
      {crossings.map((crossing) => (
        <group key={`crossing-${crossing}`} position={[crossing, 4.2, 0]}>
          {Array.from({ length: 6 }, (_, index) => (
            <mesh key={index} position={[(index - 2.5) * 8, 0, 0]}>
              <boxGeometry args={[4.5, 0.3, width * 0.68]} /><meshStandardMaterial color="#eee9d9" roughness={0.8} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function InstancedNeighborhood() {
  const plots = useRef<InstancedMesh>(null);
  const houses = useRef<InstancedMesh>(null);
  const roofs = useRef<InstancedMesh>(null);
  const windows = useRef<InstancedMesh>(null);
  const windowGlass = useRef<InstancedMesh>(null);
  const doors = useRef<InstancedMesh>(null);
  const glassMaterial = useRef<THREE.MeshStandardMaterial>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    if (glassMaterial.current) glassMaterial.current.emissiveIntensity = lighting.night * 1.8;
  });

  useLayoutEffect(() => {
    HOMES.forEach((home, index) => {
      const [x, , z] = worldPosition(home.x + 54, home.y + 21);
      const height = 17 + home.floors * 5;

      dummy.position.set(x, 0, z);
      dummy.scale.set(108, 1.5, 42);
      dummy.updateMatrix();
      plots.current?.setMatrixAt(index, dummy.matrix);
      plots.current?.setColorAt(index, new THREE.Color(index % 3 === 0 ? "#a8c58a" : "#b3cb94"));

      dummy.position.set(x, height / 2 + 2, z);
      dummy.scale.set(38, height, 28);
      dummy.updateMatrix();
      houses.current?.setMatrixAt(index, dummy.matrix);
      houses.current?.setColorAt(index, new THREE.Color(["#dfcfad", "#d7c3a0", "#e5d5b7", "#d1bd99"][index % 4]));

      dummy.position.set(x - 9, height * 0.62 + 2, z + 14.2);
      dummy.scale.set(9, 8, 1.4);
      dummy.updateMatrix();
      windows.current?.setMatrixAt(index, dummy.matrix);
      windowGlass.current?.setMatrixAt(index, dummy.matrix);

      dummy.position.set(x + 9, height * 0.29 + 2, z + 14.4);
      dummy.scale.set(6, height * 0.48, 1.6);
      dummy.updateMatrix();
      doors.current?.setMatrixAt(index, dummy.matrix);

      dummy.position.set(x, height + 8, z);
      dummy.scale.set(31, 13, 24);
      dummy.rotation.set(0, Math.PI / 4, 0);
      dummy.updateMatrix();
      roofs.current?.setMatrixAt(index, dummy.matrix);
      roofs.current?.setColorAt(index, new THREE.Color(home.roof));
      dummy.rotation.set(0, 0, 0);
    });

    for (const mesh of [plots.current, houses.current, roofs.current, windows.current, windowGlass.current, doors.current]) {
      if (mesh) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    }
  }, [dummy]);

  return (
    <group>
      <instancedMesh ref={plots} args={[undefined, undefined, HOMES.length]} receiveShadow>
        <boxGeometry args={[1, 1, 1]} /><meshStandardMaterial roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={houses} args={[undefined, undefined, HOMES.length]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} /><meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={windows} args={[undefined, undefined, HOMES.length]}>
        <boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#e7dfca" roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={windowGlass} args={[undefined, undefined, HOMES.length]}>
        <boxGeometry args={[0.72, 0.72, 1.1]} /><meshStandardMaterial ref={glassMaterial} color="#76aeb0" emissive="#ffd48a" emissiveIntensity={0} metalness={0.16} roughness={0.32} />
      </instancedMesh>
      <instancedMesh ref={doors} args={[undefined, undefined, HOMES.length]}>
        <boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#765039" roughness={0.88} />
      </instancedMesh>
      <instancedMesh ref={roofs} args={[undefined, undefined, HOMES.length]} castShadow>
        <coneGeometry args={[1, 1, 4]} /><meshStandardMaterial roughness={0.85} />
      </instancedMesh>
    </group>
  );
}

function TreeModel({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 10, 0]} castShadow><cylinderGeometry args={[2.8, 4, 20, 7]} /><meshStandardMaterial color="#76563e" /></mesh>
      <mesh position={[0, 25, 0]} castShadow><icosahedronGeometry args={[14, 1]} /><meshStandardMaterial color="#286c43" roughness={0.94} /></mesh>
      <mesh position={[-7, 31, 2]} castShadow><icosahedronGeometry args={[9, 1]} /><meshStandardMaterial color="#35844d" roughness={0.94} /></mesh>
      <mesh position={[7, 34, -2]} castShadow><icosahedronGeometry args={[8, 1]} /><meshStandardMaterial color="#4a9252" roughness={0.94} /></mesh>
    </group>
  );
}

function Tree({ x, y, scale = 1 }: Point & { scale?: number }) {
  return <TreeModel position={worldPosition(x, y)} scale={scale} />;
}

function Grove() {
  const [x, , z] = worldPosition(GROVE_CENTER.x, GROVE_CENTER.y);
  const groveTrees = useMemo(() => Array.from({ length: 38 }, (_, index) => ({
    x: GROVE_CENTER.x - 190 + ((index * 67) % 380),
    y: GROVE_CENTER.y - 190 + ((index * 97) % 380),
  })).filter((tree) => {
    const insideClearing = Math.hypot(tree.x - GROVE_CENTER.x, tree.y - GROVE_CENTER.y) < 195;
    const clearOfBuildings = !PLACED_BUILDINGS.some((building) => overlapsBuilding(tree.x - 18, tree.y - 18, 36, 36, building, 18));
    return insideClearing && isOffRoad(tree.x - 18, tree.y - 18, 36, 36, 8) &&
      Math.abs(tree.x - riverCenterAt(tree.y)) > 62 && clearOfBuildings;
  }), []);

  return (
    <>
      <group position={[x, 0, z]}>
        <mesh position={[0, 0, 0]} receiveShadow><cylinderGeometry args={[225, 236, 5, 48]} /><meshStandardMaterial color="#4b8150" roughness={1} /></mesh>
        <mesh position={[0, 3.1, 0]}><cylinderGeometry args={[217, 228, 1, 48]} /><meshStandardMaterial color="#5c9959" roughness={1} /></mesh>
        <mesh position={[0, 5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[231, 236, 64]} /><meshStandardMaterial color="#d5c491" side={THREE.DoubleSide} />
        </mesh>
      </group>
      {groveTrees.map((tree, index) => <Tree key={index} x={tree.x} y={tree.y} scale={0.7 + (index % 4) * 0.08} />)}
    </>
  );
}

function FacadeWindow({ x, y, z, width, height, rotationY = 0 }: {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  rotationY?: number;
}) {
  return (
    <group position={[x, y, z]} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0, 0.5]} castShadow><boxGeometry args={[width + 3, height + 3, 1.4]} /><meshStandardMaterial color="#d6c7a7" roughness={0.82} /></mesh>
      <mesh position={[0, 0, 1.35]}><boxGeometry args={[width, height, 1.2]} /><meshStandardMaterial color="#344c4d" roughness={0.72} /></mesh>
      <mesh position={[0, 0, 2]}><boxGeometry args={[width - 2, height - 2, 1.2]} /><meshStandardMaterial color="#7eb8b8" metalness={0.12} roughness={0.3} /></mesh>
      <mesh position={[0, 0, 2.7]}><boxGeometry args={[1.5, height, 0.8]} /><meshStandardMaterial color="#d6c7a7" roughness={0.82} /></mesh>
      <mesh position={[0, 0, 2.7]}><boxGeometry args={[width, 1.4, 0.8]} /><meshStandardMaterial color="#d6c7a7" roughness={0.82} /></mesh>
      <mesh position={[0, -height / 2 - 1.5, 1.8]} castShadow><boxGeometry args={[width + 6, 2, 3]} /><meshStandardMaterial color="#c4b28d" roughness={0.9} /></mesh>
    </group>
  );
}

function House({ building }: { building: Building }) {
  const { width, depth, height } = building;
  const [x, , z] = worldPosition(building.x + width / 2, building.y + depth / 2);

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} /><meshStandardMaterial color={building.wall} roughness={0.82} />
      </mesh>
      <mesh position={[0, height + 5, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[width * 0.72, 12, 4]} /><meshStandardMaterial color={building.roof} roughness={0.85} />
      </mesh>
      {[-0.28, 0.28].map((offset) => (
        <FacadeWindow key={offset} x={width * offset} y={height * 0.65} z={depth / 2 + 0.4} width={width * 0.15} height={height * 0.17} />
      ))}
      <FacadeWindow x={width / 2 + 0.4} y={height * 0.65} z={-depth * 0.12} width={depth * 0.16} height={height * 0.17} rotationY={Math.PI / 2} />
      <mesh position={[width * 0.22, height * 0.25, depth / 2 + 1]} castShadow>
        <boxGeometry args={[width * 0.18, height * 0.48, 2]} /><meshStandardMaterial color="#654333" roughness={0.9} />
      </mesh>
      <mesh position={[width * 0.32, height * 0.25, depth / 2 + 2.1]}>
        <sphereGeometry args={[1.2, 8, 6]} /><meshStandardMaterial color="#c49b4f" metalness={0.6} roughness={0.34} />
      </mesh>
      <mesh position={[width * 0.08, height + 0.5, 0]}>
        <boxGeometry args={[width * 0.88, 1.2, depth * 1.14]} /><meshStandardMaterial color="#d4c49f" />
      </mesh>
      {[-0.4, 0.4].map((offset) => (
        <mesh key={offset} position={[width * offset, height * 0.5, depth / 2 + 0.5]} castShadow>
          <boxGeometry args={[3, height, 3]} /><meshStandardMaterial color="#c9b993" roughness={0.86} />
        </mesh>
      ))}
    </group>
  );
}

function Market({ building }: { building: Building }) {
  const [x, , z] = worldPosition(building.x + building.width / 2, building.y + building.depth / 2);
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 3, 0]} receiveShadow><boxGeometry args={[building.width + 22, 6, building.depth + 24]} /><meshStandardMaterial color="#806344" /></mesh>
      <mesh position={[0, 20, 0]} castShadow receiveShadow><boxGeometry args={[building.width, 34, building.depth]} /><meshStandardMaterial color="#d3bd91" /></mesh>
      <mesh position={[0, 42, 0]} rotation={[0, Math.PI / 4, 0]} castShadow><coneGeometry args={[building.width * 0.72, 18, 4]} /><meshStandardMaterial color="#875a34" /></mesh>
      {Array.from({ length: 6 }, (_, index) => {
        const column = index % 3;
        const row = Math.floor(index / 3);
        const stallX = (column - 1) * 76;
        const stallZ = (row - 0.5) * 72;
        return (
          <group key={index} position={[stallX, 0, stallZ]}>
            <mesh position={[0, 17, 0]} castShadow><boxGeometry args={[56, 27, 48]} /><meshStandardMaterial color={index % 2 ? "#b99a69" : "#d0b680"} /></mesh>
            <mesh position={[0, 34, 0]} castShadow><boxGeometry args={[61, 5, 54]} /><meshStandardMaterial color={["#c95e43", "#2f7870", "#d7a441", "#a64d3c"][index % 4]} /></mesh>
            <mesh position={[0, 5, 27]}><boxGeometry args={[48, 8, 2]} /><meshStandardMaterial color="#76573c" /></mesh>
          </group>
        );
      })}
      {[-1, 1].map((side) => <mesh key={side} position={[side * 112, 20, 0]} castShadow><boxGeometry args={[8, 34, 148]} /><meshStandardMaterial color="#6c5138" /></mesh>)}
    </group>
  );
}

const ICON_SIZE = 24;
const HOME_ICON_SIZE = 30;
const PIN_STEM = 14;

function markerHeightFor(building: Building) {
  switch (building.kind) {
    case "tower":
      return building.height + 38;
    case "market":
      return 72;
    case "stadium":
      return 52;
    case "lounge":
      return building.height + 36;
    case "openbar":
      return building.id === "circle-lounge" ? 88 : 76;
    case "flyover":
      return building.height + 26;
    default:
      return building.height + 28;
  }
}

function Tower({ building }: { building: Building }) {
  const [x, , z] = worldPosition(building.x + building.width / 2, building.y + building.depth / 2);
  const floors = Math.max(4, Math.round(building.height / 25));
  const signText = building.id === "adire-tower" ? "NIKE'S GALLERY" : building.id === "civic-tower" ? "OSUN" : "OROKI";
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 6, 0]} castShadow receiveShadow><boxGeometry args={[building.width + 20, 12, building.depth + 20]} /><meshStandardMaterial color="#6c7770" /></mesh>
      <mesh position={[0, building.height / 2 + 12, 0]} castShadow receiveShadow><boxGeometry args={[building.width, building.height, building.depth]} /><meshStandardMaterial color={building.wall} metalness={0.3} roughness={0.28} /></mesh>
      <mesh position={[0, building.height + 20, 0]} castShadow><boxGeometry args={[building.width + 8, 7, building.depth + 8]} /><meshStandardMaterial color="#354953" metalness={0.35} roughness={0.25} /></mesh>
      {Array.from({ length: floors }, (_, floor) => (
        <group key={floor} position={[0, 22 + floor * (building.height / floors), 0]}>
          {[-1, 0, 1].map((column) => (
            <mesh key={column} position={[column * building.width * 0.27, 0, building.depth / 2 + 0.9]}>
              <boxGeometry args={[building.width * 0.17, 13, 1.4]} /><meshStandardMaterial color="#b5d7d7" metalness={0.42} roughness={0.2} emissive="#385763" emissiveIntensity={0.15} />
            </mesh>
          ))}
          <mesh position={[0, -9, building.depth / 2 + 1]}><boxGeometry args={[building.width * 0.92, 2, 1.2]} /><meshStandardMaterial color="#364a50" /></mesh>
        </group>
      ))}
      <Html position={[0, building.height + 26, building.depth / 2 - 4]} center zIndexRange={[100, 0]}>
        <div className="pointer-events-none rounded-sm border border-white/70 bg-[#d79b42] px-1.5 py-0.5 text-[7px] text-center font-black tracking-widest text-[#253b3e] shadow">{signText}</div>
      </Html>
    </group>
  );
}

function Stadium({ building }: { building: Building }) {
  const [x, , z] = worldPosition(building.x + building.width / 2, building.y + building.depth / 2);
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 10, 0]} castShadow receiveShadow><cylinderGeometry args={[126, 136, 20, 40]} /><meshStandardMaterial color="#d77a50" /></mesh>
      <mesh position={[0, 21, 0]}><cylinderGeometry args={[101, 108, 3, 40]} /><meshStandardMaterial color="#d8c38d" /></mesh>
      <mesh position={[0, 24, 0]}><cylinderGeometry args={[77, 84, 2, 40]} /><meshStandardMaterial color="#4e9a59" /></mesh>
      <mesh position={[0, 26, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[48, 51, 40]} /><meshStandardMaterial color="#f4e9c6" side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 25.2, 0]}><cylinderGeometry args={[1.2, 1.2, 1, 12]} /><meshStandardMaterial color="#f4e9c6" /></mesh>
    </group>
  );
}

function Lounge({ building }: { building: Building }) {
  const { width, depth, height } = building;
  const accent = building.roof;
  const [x, , z] = worldPosition(building.x + width / 2, building.y + depth / 2);

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 3, 0]} receiveShadow>
        <boxGeometry args={[width + 22, 6, depth + 22]} /><meshStandardMaterial color="#6a645d" roughness={0.95} />
      </mesh>
      <mesh position={[0, height / 2 + 6, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} /><meshStandardMaterial color={building.wall} roughness={0.7} />
      </mesh>
      <mesh position={[0, height + 8, 0]} castShadow>
        <boxGeometry args={[width + 6, 4, depth + 6]} /><meshStandardMaterial color="#25212c" roughness={0.8} />
      </mesh>
      <mesh position={[0, height + 1.5, depth / 2 + 0.9]}>
        <boxGeometry args={[width * 0.98, 2.4, 1.2]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.2} />
      </mesh>
      <mesh position={[width / 2 + 0.9, height + 1.5, 0]}>
        <boxGeometry args={[1.2, 2.4, depth * 0.98]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.2} />
      </mesh>
      <mesh position={[-width / 2 - 0.9, height + 1.5, 0]}>
        <boxGeometry args={[1.2, 2.4, depth * 0.98]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.2} />
      </mesh>
      {[-0.32, 0.32].map((offset) => (
        <mesh key={offset} position={[width * offset, height * 0.62 + 6, depth / 2 + 0.6]}>
          <boxGeometry args={[width * 0.2, height * 0.26, 1.2]} />
          <meshStandardMaterial color="#f7d8ea" emissive={accent} emissiveIntensity={0.55} roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[width / 2 + 0.6, height * 0.62 + 6, 0]}>
        <boxGeometry args={[1.2, height * 0.26, depth * 0.3]} />
        <meshStandardMaterial color="#f7d8ea" emissive={accent} emissiveIntensity={0.55} roughness={0.35} />
      </mesh>
      <mesh position={[0, height * 0.25 + 6, depth / 2 + 0.9]} castShadow>
        <boxGeometry args={[width * 0.16, height * 0.46, 1.8]} /><meshStandardMaterial color="#1a171f" roughness={0.6} />
      </mesh>
      <mesh position={[0, height * 0.5 + 6, depth / 2 + 6]} rotation={[0.22, 0, 0]} castShadow>
        <boxGeometry args={[width * 0.34, 2.2, 14]} /><meshStandardMaterial color={accent} roughness={0.55} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * width * 0.16, height * 0.25 + 6, depth / 2 + 11]} castShadow>
          <cylinderGeometry args={[0.8, 0.8, height * 0.5, 8]} /><meshStandardMaterial color="#c9b788" metalness={0.6} roughness={0.35} />
        </mesh>
      ))}
      <Html position={[0, height + 20, depth / 2 - 4]} center zIndexRange={[100, 0]}>
        <div
          className="pointer-events-none whitespace-nowrap rounded-sm border border-white/70 px-1.5 py-0.5 text-center text-[7px] font-black tracking-widest text-white shadow"
          style={{ background: accent, boxShadow: `0 0 8px ${accent}` }}
        >
          {building.name.toUpperCase()}
        </div>
      </Html>
      {building.id === "zeus-club" && <ClubSkyLights height={height + 12} />}
    </group>
  );
}

function ClubSkyLights({ height }: { height: number }) {
  const beams = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (beams.current) beams.current.visible = lighting.night > 0.2;
    beams.current?.children.forEach((beam, index) => {
      // Swing the lights from the source
      beam.rotation.x = Math.sin(clock.elapsedTime * 0.8 + index) * 0.16;
      beam.rotation.z = Math.cos(clock.elapsedTime * 0.65 + index) * 0.12;
    });
  });

  return (
    <group ref={beams} position={[0, height, 0]}>
      {["#8b5cf6", "#35d9ff", "#f04f9b"].map((color, index) => (
        <group key={color} position={[(index - 1) * 15, 0, (index - 1) * 11]}>
          
          {/* ✅ Flipped upside down so the point is at the club and the wide base is in the sky */}
          <mesh position={[0, 165, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[20, 330, 20, 1, true]} />
            <meshBasicMaterial color={color} transparent opacity={0.35} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
          
          {/* The bright inner core of the beam */}
          <mesh position={[0, 165, 0]} rotation={[Math.PI, 0, 0]}>
            <cylinderGeometry args={[2, 2, 330, 8, 1, true]} />
            <meshBasicMaterial color={color} transparent opacity={0.6} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
          
        </group>
      ))}
    </group>
  );
}

const BOTTLE_COLORS = ["#d6336c", "#e5b95b", "#2fc4b2", "#7c5cff", "#f2efe6", "#c0392b", "#3b82b6"];
const DECK_TOP = 4.35;

function BarStool({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[2.6, 2.6, 0.8, 12]} /><meshStandardMaterial color="#8d949a" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 4.5, 0]} castShadow>
        <cylinderGeometry args={[0.8, 0.8, 9, 8]} /><meshStandardMaterial color="#b8bdb9" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, 9.7, 0]} castShadow>
        <cylinderGeometry args={[3.2, 3.2, 1.8, 14]} /><meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
    </group>
  );
}

function UmbrellaTable({ position, radius, canopy, alt, striped }: {
  position: [number, number, number];
  radius: number;
  canopy: string;
  alt: string;
  striped: boolean;
}) {
  return (
    <group position={position}>
      <mesh position={[0, 0.5, 0]}><cylinderGeometry args={[4.2, 4.2, 1, 14]} /><meshStandardMaterial color="#8d949a" metalness={0.5} roughness={0.4} /></mesh>
      <mesh position={[0, 4.5, 0]}><cylinderGeometry args={[0.9, 0.9, 8, 8]} /><meshStandardMaterial color="#b8bdb9" metalness={0.6} roughness={0.35} /></mesh>
      <mesh position={[0, 9, 0]} castShadow><cylinderGeometry args={[6.4, 6.4, 1.2, 18]} /><meshStandardMaterial color="#efe9dc" roughness={0.6} /></mesh>
      <mesh position={[0, 15, 0]} castShadow><cylinderGeometry args={[0.55, 0.55, 30, 8]} /><meshStandardMaterial color="#d9d3c4" metalness={0.3} roughness={0.5} /></mesh>
      {striped ? (
        Array.from({ length: 8 }, (_, index) => (
          <mesh key={index} position={[0, 28, 0]} castShadow>
            <coneGeometry args={[radius, 8, 1, 1, false, (index * Math.PI) / 4, Math.PI / 4]} />
            <meshStandardMaterial color={index % 2 ? alt : canopy} roughness={0.7} side={THREE.DoubleSide} />
          </mesh>
        ))
      ) : (
        <mesh position={[0, 28, 0]} castShadow>
          <coneGeometry args={[radius, 8, 8]} />
          <meshStandardMaterial color={canopy} roughness={0.7} side={THREE.DoubleSide} />
        </mesh>
      )}
      <mesh position={[0, 32.6, 0]}><sphereGeometry args={[1.1, 8, 6]} /><meshStandardMaterial color="#e5b95b" metalness={0.6} roughness={0.35} /></mesh>
      {[0, 1, 2].map((index) => {
        const angle = (index * Math.PI * 2) / 3 + 0.5;
        return (
          <group key={index} position={[Math.cos(angle) * 10.5, 0, Math.sin(angle) * 10.5]}>
            <mesh position={[0, 2.5, 0]}><cylinderGeometry args={[0.7, 0.7, 5, 8]} /><meshStandardMaterial color="#8d949a" metalness={0.5} /></mesh>
            <mesh position={[0, 5.4, 0]} castShadow><cylinderGeometry args={[2.6, 2.6, 1.2, 12]} /><meshStandardMaterial color={canopy} roughness={0.6} /></mesh>
          </group>
        );
      })}
    </group>
  );
}

function OpenBar({ building }: { building: Building }) {
  const { width, depth } = building;
  const accent = building.roof;
  const premium = building.id === "circle-lounge";
  const gold = "#e5b95b";
  const [x, , z] = worldPosition(building.x + width / 2, building.y + depth / 2);

  const barWidth = Math.round(width * (premium ? 0.64 : 0.62));
  const shelfZ = -depth / 2 + 5;
  const bartenderZ = -depth / 2 + 15;
  const counterZ = -depth / 2 + 24;
  const zBack = -depth / 2 + 4;
  const zFront = counterZ + 10;
  const pergolaDepth = zFront - zBack;
  const pergolaZ = (zBack + zFront) / 2;
  const slatCount = Math.floor((barWidth + 8) / 9) + 1;
  const stoolXs = premium ? [-33, -11, 11, 33] : [-24, -8, 8, 24];
  const bottleCount = Math.floor((barWidth * 0.88) / 4.5);
  const bulbCount = Math.floor((barWidth + 12) / 8);
  const tables = premium
    ? [{ x: -48, z: 24, r: 15 }, { x: 0, z: 31, r: 17 }, { x: 48, z: 24, r: 15 }]
    : [{ x: -30, z: 20, r: 15 }, { x: 30, z: 22, r: 15 }];

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width + 14, 4, depth + 14]} /><meshStandardMaterial color={premium ? "#b9ae97" : "#5e4630"} roughness={0.95} />
      </mesh>
      <mesh position={[0, 4.15, 0]} receiveShadow>
        <boxGeometry args={[width + 8, 0.4, depth + 8]} /><meshStandardMaterial color={premium ? "#e0d6c0" : "#9a7a55"} roughness={0.85} />
      </mesh>
      {premium && (
        <mesh position={[0, 4.6, (depth + 14) / 2 - 0.6]}>
          <boxGeometry args={[width + 14, 0.8, 1.1]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.1} />
        </mesh>
      )}

      <group position={[0, DECK_TOP, 0]}>
        <mesh position={[0, 11, shelfZ]} castShadow>
          <boxGeometry args={[barWidth, 22, 4]} /><meshStandardMaterial color="#2a2230" roughness={0.8} />
        </mesh>
        <mesh position={[0, 21.2, shelfZ + 2.2]}>
          <boxGeometry args={[barWidth * 0.92, 0.5, 0.5]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.2} />
        </mesh>
        {[12, 18].map((shelfY) => (
          <group key={shelfY}>
            <mesh position={[0, shelfY, shelfZ + 3]}>
              <boxGeometry args={[barWidth * 0.94, 0.7, 4]} /><meshStandardMaterial color={premium ? "#8d6a45" : "#6b4a3a"} roughness={0.8} />
            </mesh>
            {Array.from({ length: bottleCount }, (_, index) => (
              <mesh key={index} position={[-barWidth * 0.44 + index * 4.5, shelfY + 2.9, shelfZ + 3]}>
                <cylinderGeometry args={[0.85, 0.85, 5, 8]} />
                <meshStandardMaterial color={BOTTLE_COLORS[(index + (shelfY > 12 ? 3 : 0)) % BOTTLE_COLORS.length]} roughness={0.35} metalness={0.1} />
              </mesh>
            ))}
          </group>
        ))}
        <mesh position={[0, 6, counterZ]} castShadow receiveShadow>
          <boxGeometry args={[barWidth, 12, 9]} /><meshStandardMaterial color={building.wall} roughness={0.7} />
        </mesh>
        <mesh position={[0, 12.7, counterZ]} castShadow>
          <boxGeometry args={[barWidth + 4, 1.4, 12]} /><meshStandardMaterial color={premium ? "#efe9dc" : "#7a5238"} roughness={premium ? 0.3 : 0.6} />
        </mesh>
        <mesh position={[0, 3.2, counterZ + 4.7]}>
          <boxGeometry args={[barWidth * 0.96, 1.1, 0.5]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.3} />
        </mesh>
        {premium && Array.from({ length: Math.floor(barWidth / 6) }, (_, index) => (
          <mesh key={index} position={[-barWidth / 2 + 4 + index * 6, 7, counterZ + 4.7]}>
            <boxGeometry args={[1.1, 8, 0.6]} /><meshStandardMaterial color={gold} metalness={0.7} roughness={0.3} />
          </mesh>
        ))}
        {[-22, -14, 16, 24].map((glassX) => (
          <mesh key={glassX} position={[glassX, 14.9, counterZ + 1]}>
            <cylinderGeometry args={[0.9, 0.7, 2.4, 10]} /><meshStandardMaterial color="#cfe9f0" transparent opacity={0.65} roughness={0.15} />
          </mesh>
        ))}
        <mesh position={[6, 15.2, counterZ]}>
          <cylinderGeometry args={[1.1, 0.9, 3, 10]} /><meshStandardMaterial color="#d7dadb" metalness={0.8} roughness={0.25} />
        </mesh>
        <group position={[premium ? -12 : 0, 0, bartenderZ]}>
          <PersonModel pose="shake" appearance={{ ...DEFAULT_CHARACTER_APPEARANCE, shirt: premium ? "#1f2430" : "#f4efe6", trousers: "#1f2430" }} scale={PLAYER_SCALE} />
        </group>
        {premium && (
          <group position={[12, 0, bartenderZ]}>
            <PersonModel pose="shake" appearance={{ ...DEFAULT_CHARACTER_APPEARANCE, shirt: "#1f2430", trousers: "#1f2430", skin: "#8b583b" }} scale={PLAYER_SCALE} />
          </group>
        )}
        {premium && [[-22, "#a64b70", "#68412f"], [22, "#e0ad38", "#80563d"]].map(([customerX, shirt, skin]) => (
          <group key={customerX as number} position={[customerX as number, 0, counterZ + 11]} rotation={[0, Math.PI, 0]}>
            <PersonModel pose="idle" appearance={{ ...DEFAULT_CHARACTER_APPEARANCE, shirt: shirt as string, trousers: "#30363b", skin: skin as string }} scale={PLAYER_SCALE} />
          </group>
        ))}
        {stoolXs.map((stoolX) => (
          <BarStool key={stoolX} position={[stoolX, 0, counterZ + 11]} color={accent} />
        ))}
        {[-1, 1].flatMap((side) => [zBack, zFront].map((postZ) => (
          <mesh key={`${side}-${postZ}`} position={[side * (barWidth / 2 + 4), 16, postZ]} castShadow>
            <boxGeometry args={[2, 32, 2]} /><meshStandardMaterial color="#2a2230" roughness={0.8} />
          </mesh>
        )))}
        {[zBack, zFront].map((beamZ) => (
          <mesh key={beamZ} position={[0, 32.5, beamZ]} castShadow>
            <boxGeometry args={[barWidth + 12, 1.8, 1.8]} /><meshStandardMaterial color="#2a2230" roughness={0.8} />
          </mesh>
        ))}
        {Array.from({ length: slatCount }, (_, index) => (
          <mesh key={index} position={[-(barWidth + 8) / 2 + index * 9, 33.6, pergolaZ]}>
            <boxGeometry args={[1.2, 1, pergolaDepth + 4]} /><meshStandardMaterial color={premium ? "#8d6a45" : "#6b4a3a"} roughness={0.8} />
          </mesh>
        ))}
        <mesh position={[0, 32.4, zFront + 1.2]}>
          <boxGeometry args={[barWidth + 12, 0.8, 0.8]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.3} />
        </mesh>
        {Array.from({ length: bulbCount }, (_, index) => (
          <mesh key={index} position={[-(barWidth + 12) / 2 + 4 + index * 8, 30.6, zFront]}>
            <sphereGeometry args={[0.8, 8, 6]} /><meshStandardMaterial color="#ffd98a" emissive="#ffc861" emissiveIntensity={1.4} />
          </mesh>
        ))}
        {tables.map((table, index) => (
          <UmbrellaTable
            key={index}
            position={[table.x, 0, table.z]}
            radius={table.r}
            canopy={premium ? accent : index % 2 ? "#8b5cf6" : accent}
            alt="#f5f1e6"
            striped={premium}
          />
        ))}
        {premium && (
          <>
            <mesh position={[0, 44, shelfZ - 1]}>
              <torusGeometry args={[11, 0.9, 10, 40]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.5} />
            </mesh>
            <mesh position={[0, 44, shelfZ - 1]}>
              <torusGeometry args={[6.5, 0.6, 10, 32]} /><meshStandardMaterial color={gold} emissive={gold} emissiveIntensity={1.3} />
            </mesh>
            {[-1, 1].map((side) => (
              <group key={side}>
                <mesh position={[side * (width / 2 + 1), 11, depth / 2 - 2]} castShadow>
                  <cylinderGeometry args={[0.8, 0.8, 22, 8]} /><meshStandardMaterial color="#2a2230" metalness={0.4} roughness={0.5} />
                </mesh>
                <mesh position={[side * (width / 2 + 1), 23.5, depth / 2 - 2]}>
                  <sphereGeometry args={[2.4, 12, 10]} /><meshStandardMaterial color="#ffd98a" emissive="#ffc861" emissiveIntensity={1.5} />
                </mesh>
                <group position={[side * (width / 2 - 8), 0, depth / 2 - 4]}>
                  <mesh position={[0, 2.5, 0]} castShadow><boxGeometry args={[14, 5, 6]} /><meshStandardMaterial color="#6b6a5e" roughness={0.9} /></mesh>
                  <mesh position={[-3, 7, 0]} castShadow><sphereGeometry args={[4.2, 10, 8]} /><meshStandardMaterial color="#3f8f4f" roughness={0.9} /></mesh>
                  <mesh position={[3.5, 6.4, 0]} castShadow><sphereGeometry args={[3.6, 10, 8]} /><meshStandardMaterial color="#4a9a58" roughness={0.9} /></mesh>
                </group>
              </group>
            ))}
          </>
        )}
      </group>
      <ClubSkyLights height={premium ? 45 : 35} />
      <Html position={[0, DECK_TOP + (premium ? 60 : 40), shelfZ]} center zIndexRange={[100, 0]}>
        <div
          className="pointer-events-none whitespace-nowrap rounded-sm border border-white/70 px-1.5 py-0.5 text-center text-[7px] font-black tracking-widest text-white shadow"
          style={{ background: accent, boxShadow: `0 0 8px ${accent}` }}
        >
          {building.name.toUpperCase()}
        </div>
      </Html>
    </group>
  );
}

function FlyoverStructure({ width }: { width: number }) {
  const rampGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(FLYOVER_RAMP, 0);
    shape.lineTo(0, FLYOVER_RISE);
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
  }, [width]);

  const parapetGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, FLYOVER_RISE);
    shape.lineTo(FLYOVER_RAMP, 0);
    shape.lineTo(FLYOVER_RAMP, 4);
    shape.lineTo(0, FLYOVER_RISE + 4);
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: 2, bevelEnabled: false });
  }, []);

  useEffect(() => () => {
    rampGeometry.dispose();
    parapetGeometry.dispose();
  }, [parapetGeometry, rampGeometry]);

  const angle = Math.atan2(FLYOVER_RISE, FLYOVER_RAMP);
  const rampLength = Math.hypot(FLYOVER_RAMP, FLYOVER_RISE);
  const deckLength = FLYOVER_FLAT_HALF * 2;
  const slabBottom = FLYOVER_TOP - 7;
  const pierHeight = slabBottom - 2;

  const ramps: { key: string; position: [number, number, number]; rotation: number }[] = [
    { key: "far", position: [width / 2, ROAD_SURFACE, FLYOVER_FLAT_HALF], rotation: -Math.PI / 2 },
    { key: "near", position: [-width / 2, ROAD_SURFACE, -FLYOVER_FLAT_HALF], rotation: Math.PI / 2 },
  ];

  return (
    <group>
      {ramps.map((ramp) => (
        <group key={ramp.key} position={ramp.position} rotation={[0, ramp.rotation, 0]}>
          <mesh geometry={rampGeometry} castShadow receiveShadow>
            <meshStandardMaterial color="#45494a" roughness={0.94} />
          </mesh>
          {[0, width - 2].map((offset) => (
            <mesh key={offset} geometry={parapetGeometry} position={[0, 0, offset]} castShadow>
              <meshStandardMaterial color="#cfc6ac" roughness={0.9} />
            </mesh>
          ))}
          <mesh position={[FLYOVER_RAMP / 2, FLYOVER_RISE / 2 + 0.3, width / 2]} rotation={[0, 0, -angle]}>
            <boxGeometry args={[rampLength, 0.3, 1.1]} /><meshStandardMaterial color="#e0b94f" roughness={0.72} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, FLYOVER_TOP - 3.7, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, 6.6, deckLength]} /><meshStandardMaterial color="#9d9582" roughness={0.9} />
      </mesh>
      <mesh position={[0, FLYOVER_TOP - 0.4, 0]} receiveShadow>
        <boxGeometry args={[width - 4, 0.8, deckLength]} /><meshStandardMaterial color="#45494a" roughness={0.94} />
      </mesh>
      <mesh position={[0, FLYOVER_TOP + 0.1, 0]}>
        <boxGeometry args={[1.1, 0.3, deckLength]} /><meshStandardMaterial color="#e0b94f" roughness={0.72} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (width / 2 - 1), FLYOVER_TOP + 2, 0]} castShadow>
          <boxGeometry args={[2, 4, deckLength]} /><meshStandardMaterial color="#cfc6ac" roughness={0.9} />
        </mesh>
      ))}
      {[-1, 1].map((end) => (
        <group key={end} position={[0, 0, end * (FLYOVER_FLAT_HALF - 8)]}>
          <mesh position={[0, slabBottom - 1.5, 0]} castShadow>
            <boxGeometry args={[width + 4, 3, 10]} /><meshStandardMaterial color="#8c8472" roughness={0.9} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * width * 0.29, 2 + pierHeight / 2, 0]} castShadow>
              <boxGeometry args={[7, pierHeight, 7]} /><meshStandardMaterial color="#aaa18b" roughness={0.92} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Flyover() {
  return (
    <group position={[FLYOVER_X, 0, FLYOVER_Z]}>
      <FlyoverStructure width={FLYOVER_WIDTH} />
    </group>
  );
}

function OlaiyaFlyover() {
  return (
    <group position={[OLAIYA_X, 0, OLAIYA_Z]} rotation={[0, Math.PI / 2 + UPPER_ROAD_TILT, 0]}>
      <FlyoverStructure width={OLAIYA_WIDTH} />
    </group>
  );
}

function RiverBridge({ position, rotation }: {
  position: [number, number, number];
  rotation: number;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 3, 0]} castShadow receiveShadow>
        <boxGeometry args={[116, 2, 86]} />
        <meshStandardMaterial color="#8c887d" roughness={0.9} />
      </mesh>
      <mesh position={[0, 4.08, 0]} receiveShadow>
        <boxGeometry args={[112, 0.2, 80]} />
        <meshStandardMaterial color="#414748" roughness={0.92} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[0, 0, side * 39]}>
          <mesh position={[0, 7, 0]} castShadow>
            <boxGeometry args={[112, 6, 2.5]} />
            <meshStandardMaterial color="#d0c7b1" roughness={0.86} />
          </mesh>
          <mesh position={[0, 10.2, 0]}>
            <boxGeometry args={[112, 0.9, 3]} />
            <meshStandardMaterial color="#e0b94f" roughness={0.72} />
          </mesh>
        </group>
      ))}
      {[-1, 1].map((bank) => (
        <group key={bank} position={[bank * 46, 0, 0]}>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[0, 2, side * 34]} castShadow>
              <boxGeometry args={[8, 4, 8]} />
              <meshStandardMaterial color="#aaa18b" roughness={0.92} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Billboard({ board }: { board: BillboardData }) {
  const [x, , z] = worldPosition(board.x + board.width / 2, board.y + 50);
  return (
    <group position={[x, 0, z]} rotation={[0, -0.16, 0]}>
      {[-0.3, 0.3].map((ratio) => <mesh key={ratio} position={[board.width * ratio, 42, 0]} castShadow><boxGeometry args={[6, 84, 6]} /><meshStandardMaterial color="#303a3a" /></mesh>)}
      <mesh position={[0, 96, 0]} castShadow><boxGeometry args={[board.width, 104, 9]} /><meshStandardMaterial color="#202c2d" /></mesh>
      <mesh position={[0, 97, 5]}><boxGeometry args={[board.width - 14, 88, 2]} /><meshStandardMaterial color={board.color} roughness={0.64} /></mesh>
      <Html transform position={[0, 97, 6.5]} center zIndexRange={[100, 0]}>
        <div style={{ width: `${board.width - 26}px`, height: "78px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden", textAlign: "center", color: "white", textShadow: "0 2px 3px rgba(0,0,0,.45)", fontFamily: "Arial, sans-serif", whiteSpace: "nowrap" }}>
          <div style={{ fontSize: board.title.length > 8 ? "24px" : "32px", fontWeight: 900, letterSpacing: "0.08em", lineHeight: 1.1, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}>{board.title}</div>
          <div style={{ marginTop: "8px", fontSize: "12px", fontWeight: 800, letterSpacing: "0.1em", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}>{board.subtitle}</div>
        </div>
      </Html>
    </group>
  );
}

function Wheel({ radius = 4.5, width = 3 }: { radius?: number; width?: number }) {
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[radius, radius, width, 16]} />
        <meshStandardMaterial color="#202326" roughness={0.95} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[radius * 0.53, radius * 0.53, width + 0.25, 12]} />
        <meshStandardMaterial color="#9ca4a5" metalness={0.6} roughness={0.35} />
      </mesh>
    </group>
  );
}

function CarModel({ kind, color }: { kind: "sedan" | "taxi" | "van"; color: string }) {
  const isVan = kind === "van";
  const isTaxi = kind === "taxi";
  const width = isVan ? 15 : 14;
  const length = isVan ? 34 : isTaxi ? 29 : 28;
  const bodyHeight = isVan ? 10 : 8;
  const cabinColor = isVan ? "#e5e7e4" : "#83c4d3";

  return (
    <group>
      <mesh position={[0, 7.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, bodyHeight, length]} />
        <meshStandardMaterial color={color} roughness={0.42} metalness={0.16} />
      </mesh>
      <mesh position={[0, 11, length * 0.29]} castShadow>
        <boxGeometry args={[width * 0.88, 3.4, length * 0.34]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.16} />
      </mesh>
      <mesh position={[0, isVan ? 16 : 15, -length * 0.12]} castShadow>
        <boxGeometry args={[width * 0.78, isVan ? 10 : 8, length * (isVan ? 0.58 : 0.5)]} />
        <meshStandardMaterial color={isVan ? color : "#343f43"} roughness={0.35} metalness={0.12} />
      </mesh>
      <mesh position={[0, 16, length * 0.12]} rotation={[-0.22, 0, 0]}>
        <boxGeometry args={[width * 0.67, isVan ? 6 : 5, 0.8]} />
        <meshStandardMaterial color={cabinColor} metalness={0.2} roughness={0.22} />
      </mesh>
      <mesh position={[0, 15.5, -length * 0.39]}>
        <boxGeometry args={[width * 0.62, 4.5, 0.8]} />
        <meshStandardMaterial color="#83c4d3" metalness={0.2} roughness={0.25} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          {[-0.27, 0.05, 0.32].map((part, index) => (
            <mesh key={index} position={[side * (width * 0.395), 16, length * part]}>
              <boxGeometry args={[0.55, isVan ? 5.5 : 4.2, isVan ? 0.27 : 0.25]} />
              <meshStandardMaterial color={index === 2 ? "#526a70" : "#83c4d3"} metalness={0.18} roughness={0.24} />
            </mesh>
          ))}
          <mesh position={[side * (width * 0.55), 14, length * 0.13]} castShadow>
            <boxGeometry args={[2, 2.2, 3]} />
            <meshStandardMaterial color={color} />
          </mesh>
          {!isVan && (
            <mesh position={[side * (width * 0.51), 10, -length * 0.08]}>
              <boxGeometry args={[0.6, 0.7, 2.4]} />
              <meshStandardMaterial color="#e8e8df" metalness={0.55} />
            </mesh>
          )}
        </group>
      ))}
      <mesh position={[0, 6, length * 0.505]}>
        <boxGeometry args={[width * 0.32, 2.7, 0.8]} />
        <meshStandardMaterial color="#25292b" metalness={0.35} roughness={0.4} />
      </mesh>
      <mesh position={[0, 3.8, length * 0.49]}>
        <boxGeometry args={[width * 0.96, 1.8, 1.4]} />
        <meshStandardMaterial color="#b8bdb9" metalness={0.65} roughness={0.32} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * width * 0.34, 8.3, length * 0.505]}>
            <boxGeometry args={[3, 2.2, 0.8]} />
            <meshStandardMaterial color="#fff4c6" emissive="#ffe5a0" emissiveIntensity={0.7} />
          </mesh>
          <mesh position={[side * width * 0.34, 8, -length * 0.505]}>
            <boxGeometry args={[2.6, 2.5, 0.8]} />
            <meshStandardMaterial color="#d8322e" emissive="#a91d1d" emissiveIntensity={0.25} />
          </mesh>
        </group>
      ))}
      {[-1, 1].map((side) =>
        [-1, 1].map((end) => (
          <group key={`${side}-${end}`} position={[side * (width * 0.48), 4.5, end * length * 0.31]}>
            <Wheel radius={isVan ? 5 : 4.4} width={3.2} />
          </group>
        ))
      )}
      {isTaxi && (
        <group position={[0, 21, -1]}>
          <mesh castShadow>
            <boxGeometry args={[8, 2.8, 4.5]} />
            <meshStandardMaterial color="#f7d34d" />
          </mesh>
          <mesh position={[0, 1.7, 0]}>
            <boxGeometry args={[5, 0.5, 2.8]} />
            <meshStandardMaterial color="#fff0a0" emissive="#f6cf53" emissiveIntensity={0.3} />
          </mesh>
        </group>
      )}
      {isVan && (
        <mesh position={[0, 14, -length * 0.48]}>
          <boxGeometry args={[width * 0.6, 5, 0.8]} />
          <meshStandardMaterial color="#aab4b5" roughness={0.5} />
        </mesh>
      )}
    </group>
  );
}

function MotorcycleModel({ color }: { color: string }) {
  const frontWheel = useRef<Group>(null);
  const rearWheel = useRef<Group>(null);

  return (
    <group>
      <group ref={rearWheel} position={[0, 4.5, -11]}>
        <Wheel radius={4.5} width={2.5} />
      </group>
      <group ref={frontWheel} position={[0, 4.5, 11]}>
        <Wheel radius={4.5} width={2.5} />
      </group>
      <mesh position={[0, 8, -1]} rotation={[0.18, 0, 0]}>
        <boxGeometry args={[3.5, 3, 12]} />
        <meshStandardMaterial color="#30363a" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 10, 1]} rotation={[0.12, 0, 0]}>
        <capsuleGeometry args={[2.4, 4.5, 4, 8]} />
        <meshStandardMaterial color={color} metalness={0.2} roughness={0.38} />
      </mesh>
      <mesh position={[0, 12, -5]}>
        <boxGeometry args={[4, 2, 7]} />
        <meshStandardMaterial color="#25282a" roughness={0.85} />
      </mesh>
      <mesh position={[0, 9, -8]}>
        <boxGeometry args={[4.5, 3, 4]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 8.5, 8.5]} rotation={[-0.22, 0, 0]}>
        <cylinderGeometry args={[0.7, 0.7, 10, 8]} />
        <meshStandardMaterial color="#a7b2b6" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 14, 8]}>
        <boxGeometry args={[10, 1.2, 1.4]} />
        <meshStandardMaterial color="#292e32" metalness={0.5} />
      </mesh>
      <mesh position={[0, 12, 10.5]}>
        <sphereGeometry args={[2, 10, 8]} />
        <meshStandardMaterial color="#fff1bd" emissive="#ffdc88" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0, 11, -10]}>
        <boxGeometry args={[2.4, 1.8, 1]} />
        <meshStandardMaterial color="#df302c" emissive="#a81717" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

/* -------------------- DETAILED 3D PEOPLE with customization -------------------- */

function PersonModel({
  appearance = DEFAULT_CHARACTER_APPEARANCE,
  scale = 1,
  pose = "walk",
}: {
  appearance?: CharacterAppearance;
  scale?: number;
  pose?: "walk" | "shake" | "idle";
}) {
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);

  const isWoman = appearance.gender === "Woman";
  const isChill = appearance.outfit === "Chill" || appearance.outfit === "Hoodie";
  const isAnkara = appearance.fabric === "Ankara" || appearance.fabric === "Adire" || appearance.fabric === "Aso-oke";

  // Adjust proportions by gender
  const torsoWidth = isWoman ? 5.4 : 6.2;
  const hipWidth = isWoman ? 11 : 10;
  const shoulderWidth = isWoman ? 12 : 14;

  // Build hairstyle geometry
  const renderHair = () => {
    switch (appearance.hairstyle) {
      case "bald":
        return null;
      case "afro":
        return (
          <mesh position={[0, 44.5, -0.5]} castShadow>
            <sphereGeometry args={[8.5, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.75]} />
            <meshStandardMaterial color={appearance.hair} roughness={0.98} />
          </mesh>
        );
      case "braids":
        return (
          <group>
            <mesh position={[0, 42.5, -0.8]} castShadow>
              <sphereGeometry args={[6.6, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
              <meshStandardMaterial color={appearance.hair} roughness={0.98} />
            </mesh>
            {[-3, -1.5, 0, 1.5, 3].map((x, index) => (
              <mesh key={index} position={[x, 38, -6]} castShadow>
                <capsuleGeometry args={[0.7, 14, 3, 6]} />
                <meshStandardMaterial color={appearance.hair} roughness={0.98} />
              </mesh>
            ))}
          </group>
        );
      case "locs":
        return (
          <group>
            <mesh position={[0, 43, -0.8]} castShadow>
              <sphereGeometry args={[6.8, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
              <meshStandardMaterial color={appearance.hair} roughness={0.98} />
            </mesh>
            {[-4, -2, 0, 2, 4].map((x, index) => (
              <mesh key={index} position={[x, 37, -5.5]} rotation={[0.15, 0, x * 0.05]} castShadow>
                <capsuleGeometry args={[0.9, 16, 3, 6]} />
                <meshStandardMaterial color={appearance.hair} roughness={0.98} />
              </mesh>
            ))}
          </group>
        );
      case "curls":
        return (
          <group>
            {Array.from({ length: 12 }, (_, index) => {
              const angle = (index / 12) * Math.PI * 2;
              const r = 5.5;
              return (
                <mesh
                  key={index}
                  position={[Math.cos(angle) * r, 43 + Math.sin(angle) * 2, Math.sin(angle) * r * 0.8 - 0.5]}
                  castShadow
                >
                  <sphereGeometry args={[2, 8, 6]} />
                  <meshStandardMaterial color={appearance.hair} roughness={0.98} />
                </mesh>
              );
            })}
            <mesh position={[0, 43, -0.5]} castShadow>
              <sphereGeometry args={[6, 12, 8]} />
              <meshStandardMaterial color={appearance.hair} roughness={0.98} />
            </mesh>
          </group>
        );
      case "classic":
        return (
          <mesh position={[0, 42.5, 0]} castShadow>
            <sphereGeometry args={[6.6, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
            <meshStandardMaterial color={appearance.hair} roughness={0.98} />
          </mesh>
        );
      case "short":
      default:
        return (
          <mesh position={[0, 42, -0.8]} castShadow>
            <sphereGeometry args={[6.45, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
            <meshStandardMaterial color={appearance.hair} roughness={0.98} />
          </mesh>
        );
    }
  };

  // Build outfit details
  const renderOutfitDetails = () => {
    if (isAnkara) {
      // Add pattern stripes to suggest Ankara fabric
      return (
        <group>
          {[-2, -1, 0, 1, 2].map((offset) => (
            <mesh key={offset} position={[0, 23 + offset * 2, torsoWidth * 0.98]} rotation={[0.05, 0, 0]}>
              <boxGeometry args={[torsoWidth * 1.6, 0.6, 0.2]} />
              <meshStandardMaterial color={appearance.trousers} roughness={0.7} />
            </mesh>
          ))}
        </group>
      );
    }
    if (isChill) {
      // Hoodie pocket
      return (
        <mesh position={[0, 19, torsoWidth * 0.95]}>
          <boxGeometry args={[torsoWidth * 1.3, 3, 0.8]} />
          <meshStandardMaterial color={appearance.shirt} roughness={0.85} />
        </mesh>
      );
    }
    return null;
  };

  useFrame(({ clock }) => {
    if (pose !== "walk") {
      const t = clock.elapsedTime;
      if (leftLeg.current) leftLeg.current.rotation.x = 0;
      if (rightLeg.current) rightLeg.current.rotation.x = 0;
      if (pose === "shake") {
        if (leftArm.current) leftArm.current.rotation.x = -0.9 + Math.sin(t * 6) * 0.22;
        if (rightArm.current) rightArm.current.rotation.x = -1.15 + Math.sin(t * 6 + 1) * 0.25;
      } else {
        if (leftArm.current) leftArm.current.rotation.x = -0.15 + Math.sin(t * 1.1) * 0.05;
        if (rightArm.current) rightArm.current.rotation.x = -0.75 + Math.sin(t * 0.8) * 0.08;
      }
      return;
    }
    const time = clock.elapsedTime * 7;
    if (leftArm.current) leftArm.current.rotation.x = Math.sin(time) * 0.3;
    if (rightArm.current) rightArm.current.rotation.x = -Math.sin(time) * 0.3;
    if (leftLeg.current) leftLeg.current.rotation.x = -Math.sin(time) * 0.32;
    if (rightLeg.current) rightLeg.current.rotation.x = Math.sin(time) * 0.32;
  });

  return (
    <group scale={scale}>
      {/* Shoes */}
      <mesh position={[-3, 2, 2]} castShadow>
        <boxGeometry args={[5, 3.5, 8]} />
        <meshStandardMaterial color="#24272b" roughness={0.8} />
      </mesh>
      <mesh position={[3, 2, 2]} castShadow>
        <boxGeometry args={[5, 3.5, 8]} />
        <meshStandardMaterial color="#24272b" roughness={0.8} />
      </mesh>

      {/* Animated legs */}
      <group ref={leftLeg} position={[-3, 10, 0]}>
        <mesh position={[0, -4, 0]} castShadow>
          <capsuleGeometry args={[2.6, 7, 4, 8]} />
          <meshStandardMaterial color={appearance.trousers} roughness={0.85} />
        </mesh>
      </group>
      <group ref={rightLeg} position={[3, 10, 0]}>
        <mesh position={[0, -4, 0]} castShadow>
          <capsuleGeometry args={[2.6, 7, 4, 8]} />
          <meshStandardMaterial color={appearance.trousers} roughness={0.85} />
        </mesh>
      </group>

      {/* Torso */}
      <mesh position={[0, 23, 0]} castShadow>
        <capsuleGeometry args={[torsoWidth, 11, 5, 10]} />
        <meshStandardMaterial color={appearance.shirt} roughness={0.72} />
      </mesh>
      <mesh position={[0, 15, 0]}>
        <boxGeometry args={[hipWidth, 3, 7]} />
        <meshStandardMaterial color={appearance.trousers} />
      </mesh>
      <mesh position={[0, 24, torsoWidth * 0.98]}>
        <boxGeometry args={[1.2, 8, 0.7]} />
        <meshStandardMaterial color={appearance.trousers} roughness={0.78} />
      </mesh>

      {renderOutfitDetails()}

      {/* Collar/shoulders */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 2.2, 29, 4.7]} rotation={[0.35, 0, side * 0.28]}>
          <boxGeometry args={[4, 1.5, 3]} />
          <meshStandardMaterial color={appearance.shirt} roughness={0.72} />
        </mesh>
      ))}

      {/* Neck */}
      <mesh position={[0, 32, 0]}>
        <cylinderGeometry args={[2, 2.2, 4, 8]} />
        <meshStandardMaterial color={appearance.skin} roughness={0.9} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 39, 0]} castShadow>
        <sphereGeometry args={[6.3, 16, 12]} />
        <meshStandardMaterial color={appearance.skin} roughness={0.88} />
      </mesh>

      {/* Hair - customized */}
      {renderHair()}

      {/* Ears */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 6, 38.5, 0]}>
          <sphereGeometry args={[1.3, 8, 8]} />
          <meshStandardMaterial color={appearance.skin} />
        </mesh>
      ))}

      {/* Eyes */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 2.3, 40, 5.55]}>
          <sphereGeometry args={[0.75, 8, 8]} />
          <meshStandardMaterial color="#211b18" />
        </mesh>
      ))}

      {/* Eyebrows */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 2.3, 41.6, 5.3]} rotation={[0, 0, side * -0.12]}>
          <boxGeometry args={[2.5, 0.8, 0.8]} />
          <meshStandardMaterial color={appearance.hair} roughness={0.96} />
        </mesh>
      ))}

      {/* Nose */}
      <mesh position={[0, 38.8, 6.2]}>
        <sphereGeometry args={[1.05, 8, 8]} />
        <meshStandardMaterial color={appearance.skin} />
      </mesh>

      {/* Mouth */}
      <mesh position={[0, 36.2, 6.05]}>
        <boxGeometry args={[2.2, 0.7, 0.45]} />
        <meshStandardMaterial color="#4b2921" roughness={0.9} />
      </mesh>

      {/* Arms */}
      <group ref={leftArm} position={[-shoulderWidth / 2, 28, 0]}>
        <mesh position={[0, -5, 0]} rotation={[0, 0, -0.12]} castShadow>
          <capsuleGeometry args={[2.1, 8, 4, 8]} />
          <meshStandardMaterial color={appearance.shirt} roughness={0.78} />
        </mesh>
        <mesh position={[-0.6, -10, 0]}>
          <sphereGeometry args={[2, 8, 8]} />
          <meshStandardMaterial color={appearance.skin} />
        </mesh>
      </group>
      <group ref={rightArm} position={[shoulderWidth / 2, 28, 0]}>
        <mesh position={[0, -5, 0]} rotation={[0, 0, 0.12]} castShadow>
          <capsuleGeometry args={[2.1, 8, 4, 8]} />
          <meshStandardMaterial color={appearance.shirt} roughness={0.78} />
        </mesh>
        <mesh position={[0.6, -10, 0]}>
          <sphereGeometry args={[2, 8, 8]} />
          <meshStandardMaterial color={appearance.skin} />
        </mesh>
      </group>
    </group>
  );
}

function TrafficVehicle({
  kind,
  color,
  speed,
  start,
  lane,
  road,
}: TrafficVehicleProps) {
  const vehicleRef = useRef<Group>(null);
  const wheelGroups = useRef<Group[]>([]);
  const progress = useRef(start);

  useFrame((_, delta) => {
    const vehicle = vehicleRef.current;
    if (!vehicle) return;

    progress.current += delta * speed;

    if (road === "vertical") {
      const span = WORLD_HEIGHT - 100;
      const z = (progress.current % span) - span / 2 - 20;
      vehicle.position.set(VERTICAL_ROAD_X + lane, flyoverHeight(z), z);
      vehicle.rotation.set(-Math.atan(flyoverSlope(z)), 0, 0);
    } else {
      const tilt = road === "upper" ? UPPER_ROAD_TILT : LOWER_ROAD_TILT;
      const span = WORLD_WIDTH - 100;
      const along = (progress.current % span) - span / 2;
      const baseZ = road === "upper" ? -370 : 570;
      const height = road === "upper" ? upperFlyoverHeight(along) : ROAD_SURFACE;
      const pitch = road === "upper" ? -Math.atan(upperFlyoverSlope(along)) : 0;
      vehicle.position.set(
        along * Math.cos(tilt) + lane * Math.sin(tilt),
        height,
        baseZ - along * Math.sin(tilt) + lane * Math.cos(tilt)
      );
      vehicle.rotation.order = "YXZ";
      vehicle.rotation.set(pitch, Math.PI / 2 + tilt, 0);
    }

    wheelGroups.current.forEach((wheel) => {
      wheel.rotation.x -= delta * speed / 4.5;
    });
  });

  return (
    <group ref={vehicleRef}>
      {kind === "bike" ? (
        <>
          <MotorcycleModel color={color} />
          <group position={[0, 8, -1]} rotation={[-0.12, 0, 0]}>
            <mesh position={[0, 12, -1]} castShadow>
              <capsuleGeometry args={[3.2, 9, 4, 8]} />
              <meshStandardMaterial color="#d7dce0" roughness={0.7} />
            </mesh>
            <mesh position={[0, 22, 0]} castShadow>
              <sphereGeometry args={[4, 12, 10]} />
              <meshStandardMaterial color="#80563d" roughness={0.9} />
            </mesh>
            <mesh position={[0, 24, 0]}>
              <sphereGeometry args={[4.3, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
              <meshStandardMaterial color="#202a35" roughness={0.8} />
            </mesh>
            <mesh position={[-4, 12, 4]} rotation={[0.8, 0, -0.3]}>
              <capsuleGeometry args={[1.5, 7, 3, 6]} />
              <meshStandardMaterial color="#d7dce0" />
            </mesh>
            <mesh position={[4, 12, 4]} rotation={[0.8, 0, 0.3]}>
              <capsuleGeometry args={[1.5, 7, 3, 6]} />
              <meshStandardMaterial color="#d7dce0" />
            </mesh>
          </group>
        </>
      ) : (
        <CarModel kind={kind} color={color} />
      )}
    </group>
  );
}

function CityTraffic() {
  return (
    <group>
      <TrafficVehicle kind="sedan" color="#d94e3f" speed={115} start={120} lane={-18} road="upper" />
      <TrafficVehicle kind="van" color="#e9e6dc" speed={76} start={1450} lane={-18} road="upper" />
      <TrafficVehicle kind="taxi" color="#f0bd36" speed={88} start={700} lane={18} road="upper" />
      <TrafficVehicle kind="taxi" color="#f0bd36" speed={92} start={850} lane={18} road="lower" />
      <TrafficVehicle kind="sedan" color="#2f6f9f" speed={105} start={380} lane={-18} road="lower" />
      <TrafficVehicle kind="van" color="#c9d2d6" speed={70} start={1500} lane={18} road="lower" />
      <TrafficVehicle kind="bike" color="#286fba" speed={130} start={600} lane={-7} road="vertical" />
      <TrafficVehicle kind="sedan" color="#3f8f5c" speed={100} start={150} lane={7} road="vertical" />
      <TrafficVehicle kind="taxi" color="#f0bd36" speed={84} start={1100} lane={-7} road="vertical" />
      <TrafficVehicle kind="van" color="#a64d3c" speed={68} start={900} lane={7} road="vertical" />
    </group>
  );
}

function CityPedestrian({
  x,
  y,
  appearance,
  offset,
}: Point & {
  appearance: CharacterAppearance;
  offset: number;
}) {
  const groupRef = useRef<Group>(null);
  const start = useMemo(() => worldPosition(x, y), [x, y]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime * 0.45 + offset;
    groupRef.current.position.x = start[0] + Math.sin(t) * 16;
    groupRef.current.position.z = start[2] + Math.cos(t) * 16;
    groupRef.current.rotation.y = Math.atan2(Math.cos(t), -Math.sin(t));
  });

  return (
    <group ref={groupRef} position={start}>
      <PersonModel appearance={appearance} scale={PEDESTRIAN_SCALE} />
    </group>
  );
}

function CityPeople() {
  const people: { x: number; y: number; appearance: CharacterAppearance; offset: number }[] = [
    { x: 610, y: 920, appearance: { ...DEFAULT_CHARACTER_APPEARANCE, shirt: "#d65b3f", trousers: "#26364d", skin: "#74452f" }, offset: 0 },
    { x: 1145, y: 920, appearance: { ...DEFAULT_CHARACTER_APPEARANCE, shirt: "#e0ad38", trousers: "#30363b", skin: "#8d5a3b" }, offset: 1.7 },
    { x: 1285, y: 970, appearance: { ...DEFAULT_CHARACTER_APPEARANCE, shirt: "#2876b9", trousers: "#4a413a", skin: "#68412f" }, offset: 3.1 },
    { x: 1630, y: 1210, appearance: { ...DEFAULT_CHARACTER_APPEARANCE, shirt: "#4b925c", trousers: "#273448", skin: "#80563d" }, offset: 4.5 },
    { x: 1950, y: 940, appearance: { ...DEFAULT_CHARACTER_APPEARANCE, shirt: "#a64b70", trousers: "#3e454c", skin: "#70472f" }, offset: 2.3 },
    { x: 410, y: 600, appearance: { ...DEFAULT_CHARACTER_APPEARANCE, shirt: "#f0bd36", trousers: "#30363b", skin: "#8b583b" }, offset: 5.2 },
  ];

  return (
    <group>
      {people.map((person, index) => (
        <CityPedestrian key={index} {...person} />
      ))}
    </group>
  );
}

function BuildingModel({ building }: { building: Building }) {
  switch (building.kind) {
    case "stadium":
      return <Stadium building={building} />;
    case "market":
      return <Market building={building} />;
    case "tower":
      return <Tower building={building} />;
    case "lounge":
      return <Lounge building={building} />;
    case "openbar":
      return <OpenBar building={building} />;
    case "flyover":
      return building.id === "olaiya" ? <OlaiyaFlyover /> : <Flyover />;
    default:
      return <House building={building} />;
  }
}

function Landmark({ building, selected, onVisit }: {
  building: Building;
  selected: boolean;
  onVisit: (building: Building) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const centerX = building.x + building.width / 2;
  const [x, , z] = worldPosition(centerX, building.y + building.depth / 2);
  const markerHeight = markerHeightFor(building);
  const isPlayerHome = building.id === HOME_BUILDING.id;
  const flipLabel = centerX > LABEL_FLIP_X;
  const labelAlwaysVisible = isPlayerHome || selected;
  const raised = hovered || selected;
  const iconSize = isPlayerHome ? HOME_ICON_SIZE : ICON_SIZE;

  return (
    <>
      <group onClick={(event) => {
        event.stopPropagation();
        onVisit(building);
      }}>
        <BuildingModel building={building} />
      </group>
      <Html position={[x, markerHeight, z]} center zIndexRange={raised ? [16777371, 16777300] : [16777271, 0]}>
        <div className="flex flex-col items-center" style={{ transform: `translateY(-${(iconSize + PIN_STEM) / 2}px)` }}>
          <button
            type="button"
            data-world-object
            aria-label={`Visit ${building.name}`}
            aria-pressed={selected}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerEnter={() => setHovered(true)}
            onPointerLeave={() => setHovered(false)}
            onFocus={() => setHovered(true)}
            onBlur={() => setHovered(false)}
            onClick={() => onVisit(building)}
            className={`group relative flex items-center justify-center rounded-full bg-white leading-none shadow-[0_3px_10px_rgba(20,40,33,0.35)] transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#20b978] ${isPlayerHome ? "border-2 border-[#20b978] text-[15px]" : "border border-white text-[12px]"} ${selected ? "ring-2 ring-[#20b978]" : ""}`}
            style={{ width: iconSize, height: iconSize, touchAction: "none" }}
          >
            {building.icon}
            <span className={`pointer-events-none absolute top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-[#e5eae5] bg-white px-2.5 py-1 text-[10px] font-bold text-[#27352d] shadow-md transition-opacity duration-200 ${flipLabel ? "right-[calc(100%+6px)]" : "left-[calc(100%+6px)]"} ${labelAlwaysVisible ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"}`}>
              {building.name}
            </span>
          </button>
          <span aria-hidden className="pointer-events-none block w-px bg-[#27352d]/70" style={{ height: PIN_STEM }} />
        </div>
      </Html>
    </>
  );
}

function AnimatedPlayer({
  destination,
  appearance,
}: {
  destination: Point;
  appearance: CharacterAppearance;
}) {
  const playerRef = useRef<Group>(null);
  const step = useRef(0);
  const logCounter = useRef(0);
  const target = useMemo(
    () => new THREE.Vector3(...worldPosition(destination.x, destination.y, 0)),
    [destination]
  );

  useFrame((_, delta) => {
    const player = playerRef.current;
    if (!player) return;

    const distance = player.position.distanceTo(target);
    player.position.lerp(target, 1 - Math.exp(-delta * 2.7));

    step.current += delta * (distance > 8 ? 12 : 2);
    player.position.y = Math.abs(Math.sin(step.current)) * (distance > 8 ? 2 : 0.5);

    if (distance > 2) {
      const dirX = target.x - player.position.x;
      const dirZ = target.z - player.position.z;
      player.rotation.y = Math.atan2(dirX, dirZ);
    }

    // Log every ~60 frames (about once per second)
    logCounter.current += 1;
    if (logCounter.current % 60 === 0) {
      console.log("[AnimatedPlayer] position", {
        x: player.position.x.toFixed(1),
        y: player.position.y.toFixed(1),
        z: player.position.z.toFixed(1),
        targetX: target.x.toFixed(1),
        targetZ: target.z.toFixed(1),
      });
    }
  });

  return (
    <group ref={playerRef} position={worldPosition(destination.x, destination.y)}>
      <CharacterModel
        key={`map-player-${appearance.skin}-${appearance.hairstyle}-${appearance.shirt}`}
        appearance={appearance}
        targetHeight={30}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.3, 0]}>
        <circleGeometry args={[14, 20]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

/* -------------------- Day and night -------------------- */

const lighting = { night: 0 };

type LightingKey = {
  hour: number;
  sky: string;
  ambient: number;
  ambientColor: string;
  hemisphere: number;
  hemisphereSky: string;
  hemisphereGround: string;
  sun: number;
  sunColor: string;
  sunPosition: [number, number, number];
  night: number;
};

const NIGHT_LOOK = {
  sky: "#0b1630",
  ambient: 0.55,
  ambientColor: "#8094d6",
  hemisphere: 0.6,
  hemisphereSky: "#2f4488",
  hemisphereGround: "#1c2431",
  sun: 0.8,
  sunColor: "#9db6ff",
  sunPosition: [900, 1800, -700] as [number, number, number],
  night: 1,
};

const DAY_LOOK = {
  sky: "#4babc0",
  ambient: 1.35,
  ambientColor: "#ffffff",
  hemisphere: 1.7,
  hemisphereSky: "#fff4dc",
  hemisphereGround: "#526c51",
  sun: 2.3,
  sunColor: "#ffffff",
  sunPosition: [-850, 1900, 1100] as [number, number, number],
  night: 0,
};

const LIGHTING_KEYS: LightingKey[] = [
  { hour: 0, ...NIGHT_LOOK },
  { hour: 5, ...NIGHT_LOOK },
  {
    hour: 6.5, sky: "#f0a27c", ambient: 0.9, ambientColor: "#ffd2b0", hemisphere: 1,
    hemisphereSky: "#ffd9bd", hemisphereGround: "#5a6a58", sun: 1.4, sunColor: "#ffb37a",
    sunPosition: [-1900, 700, 500], night: 0.55,
  },
  { hour: 8, ...DAY_LOOK },
  { hour: 17, ...DAY_LOOK },
  {
    hour: 18, sky: "#e48a5a", ambient: 1, ambientColor: "#ffd2b0", hemisphere: 1.1,
    hemisphereSky: "#ffd9bd", hemisphereGround: "#5a6a58", sun: 1.5, sunColor: "#ff9a5c",
    sunPosition: [1700, 650, 700], night: 0.35,
  },
  { hour: 19, ...NIGHT_LOOK },
  { hour: 24, ...NIGHT_LOOK },
];

function sampleLighting(hour: number) {
  const h = ((hour % 24) + 24) % 24;
  const nextIndex = Math.max(1, LIGHTING_KEYS.findIndex((key) => key.hour > h));
  const previous = LIGHTING_KEYS[nextIndex - 1];
  const next = LIGHTING_KEYS[nextIndex];
  const linear = (h - previous.hour) / (next.hour - previous.hour);
  const t = linear * linear * (3 - 2 * linear);

  const mix = (a: number, b: number) => a + (b - a) * t;
  const mixColor = (a: string, b: string) => new THREE.Color(a).lerp(new THREE.Color(b), t);

  return {
    sky: mixColor(previous.sky, next.sky),
    ambient: mix(previous.ambient, next.ambient),
    ambientColor: mixColor(previous.ambientColor, next.ambientColor),
    hemisphere: mix(previous.hemisphere, next.hemisphere),
    hemisphereSky: mixColor(previous.hemisphereSky, next.hemisphereSky),
    hemisphereGround: mixColor(previous.hemisphereGround, next.hemisphereGround),
    sun: mix(previous.sun, next.sun),
    sunColor: mixColor(previous.sunColor, next.sunColor),
    sunPosition: new THREE.Vector3(...previous.sunPosition).lerp(new THREE.Vector3(...next.sunPosition), t),
    night: mix(previous.night, next.night),
  };
}

function Atmosphere({ hour }: { hour: number }) {
  const scene = useThree((state) => state.scene);
  const ambient = useRef<THREE.AmbientLight>(null);
  const hemisphere = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => sampleLighting(hour), [hour]);
  const snapped = useRef(false);

  useFrame((_, delta) => {
    const k = snapped.current ? 1 - Math.exp(-delta * 1.5) : 1;
    snapped.current = true;

    if (scene.background instanceof THREE.Color) scene.background.lerp(target.sky, k);
    lighting.night += (target.night - lighting.night) * k;

    if (ambient.current) {
      ambient.current.color.lerp(target.ambientColor, k);
      ambient.current.intensity += (target.ambient - ambient.current.intensity) * k;
    }
    if (hemisphere.current) {
      hemisphere.current.color.lerp(target.hemisphereSky, k);
      hemisphere.current.groundColor.lerp(target.hemisphereGround, k);
      hemisphere.current.intensity += (target.hemisphere - hemisphere.current.intensity) * k;
    }
    if (sun.current) {
      sun.current.color.lerp(target.sunColor, k);
      sun.current.intensity += (target.sun - sun.current.intensity) * k;
      sun.current.position.lerp(target.sunPosition, k);
    }
  });

  return (
    <>
      <color attach="background" args={[DAY_LOOK.sky]} />
      <ambientLight ref={ambient} intensity={DAY_LOOK.ambient} />
      <hemisphereLight ref={hemisphere} args={[DAY_LOOK.hemisphereSky, DAY_LOOK.hemisphereGround, DAY_LOOK.hemisphere]} />
      <directionalLight
        ref={sun}
        position={DAY_LOOK.sunPosition}
        intensity={DAY_LOOK.sun}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-1500}
        shadow-camera-right={1500}
        shadow-camera-top={1200}
        shadow-camera-bottom={-1200}
      />
    </>
  );
}

function StreetLamps() {
  const poles = useRef<InstancedMesh>(null);
  const bulbs = useRef<InstancedMesh>(null);
  const bulbMaterial = useRef<THREE.MeshStandardMaterial>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    LAMPS.forEach((lamp, index) => {
      dummy.position.set(lamp.x, 22, lamp.y);
      dummy.updateMatrix();
      poles.current?.setMatrixAt(index, dummy.matrix);
      dummy.position.set(lamp.x, 41.5, lamp.y);
      dummy.updateMatrix();
      bulbs.current?.setMatrixAt(index, dummy.matrix);
    });
    for (const mesh of [poles.current, bulbs.current]) {
      if (mesh) mesh.instanceMatrix.needsUpdate = true;
    }
  }, [dummy]);

  useFrame(() => {
    if (bulbMaterial.current) bulbMaterial.current.emissiveIntensity = 0.1 + lighting.night * 2.4;
  });

  return (
    <group>
      <instancedMesh ref={poles} args={[undefined, undefined, LAMPS.length]} frustumCulled={false} castShadow>
        <cylinderGeometry args={[1, 1.4, 37, 6]} /><meshStandardMaterial color="#3a4144" metalness={0.4} roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={bulbs} args={[undefined, undefined, LAMPS.length]} frustumCulled={false}>
        <sphereGeometry args={[3.4, 10, 8]} />
        <meshStandardMaterial ref={bulbMaterial} color="#fff2c9" emissive="#ffd27a" emissiveIntensity={0.1} />
      </instancedMesh>
    </group>
  );
}

const CAMERA_DIRECTION = new THREE.Vector3(0, 2450, 2350).normalize();
const FOCUS_DISTANCE = 950;
const FOCUS_START_DISTANCE = 2400;
const FOCUS_DURATION = 1.6;

type OrbitLike = {
  target: THREE.Vector3;
  update: () => void;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
};

function FocusOnPlayer({ active, focus }: { active: boolean; focus: THREE.Vector3 }) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as unknown as OrbitLike | null;
  const focusRef = useRef(focus);
  const armed = useRef(true);
  const animation = useRef<{
    elapsed: number;
    start: THREE.Vector3;
    end: THREE.Vector3;
    target: THREE.Vector3;
  } | null>(null);

  // Keep the focus ref fresh WITHOUT touching it during render
  useEffect(() => {
    focusRef.current = focus;
  }, [focus]);

  useEffect(() => {
    if (!active) armed.current = true;
  }, [active]);

  useEffect(() => {
    if (!active || !controls || !armed.current) return;
    armed.current = false;

    const target = focusRef.current.clone();
    const start = target
      .clone()
      .add(CAMERA_DIRECTION.clone().multiplyScalar(FOCUS_START_DISTANCE));
    const end = target
      .clone()
      .add(CAMERA_DIRECTION.clone().multiplyScalar(FOCUS_DISTANCE));

    camera.position.copy(start);
    controls.target.copy(target);
    controls.update();
    animation.current = { elapsed: 0, start, end, target };

    const cancel = () => {
      animation.current = null;
    };
    controls.addEventListener("start", cancel);
    return () => controls.removeEventListener("start", cancel);
  }, [active, camera, controls]);

  useFrame((_, delta) => {
    const current = animation.current;
    if (!current || !controls) return;

    current.elapsed += delta;
    const t = Math.min(current.elapsed / FOCUS_DURATION, 1);
    const eased = 1 - Math.pow(1 - t, 3);

    camera.position.lerpVectors(current.start, current.end, eased);
    controls.target.copy(current.target);
    controls.update();
    if (t >= 1) animation.current = null;
  });

  return null;
}

function Scene({ active, interactive, hour, appearance, onVisit, onEnterBuilding }: {
  active: boolean;
  interactive: boolean;
  hour: number;
  appearance: CharacterAppearance;
  onVisit: (building: Building) => void;
  onEnterBuilding: (buildingName: string, buildingId: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [destination, setDestination] = useState<Point>({
    x: HOME_BUILDING.x + HOME_BUILDING.width / 2,
    y: HOME_BUILDING.y + HOME_BUILDING.depth + 35,
  });
  const playerFocus = useMemo(() => new THREE.Vector3(...worldPosition(destination.x, destination.y, 0)), [destination]);
  const riverGeometry = useMemo(() => createRiverGeometry(), []);
  const grassTexture = useMemo(() => createGrassTexture(), []);
  const asphaltTexture = useMemo(() => createRoadTexture(), []);
  const oceanTexture = useMemo(() => createOceanTexture(), []);
  const beachGeometry = useMemo(() => createIslandGeometry(1.06), []);
  const islandGeometry = useMemo(() => createIslandGeometry(1), []);
  const cliffGeometry = useMemo(() => createIslandCliffGeometry(), []);

  useEffect(() => () => {
    grassTexture.dispose();
    asphaltTexture.dispose();
    oceanTexture.dispose();
    beachGeometry.dispose();
    islandGeometry.dispose();
    cliffGeometry.dispose();
  }, [asphaltTexture, beachGeometry, cliffGeometry, grassTexture, islandGeometry, oceanTexture]);

  function visit(building: Building) {
    setSelected(building.id);
    setDestination({ x: building.x + building.width / 2, y: building.y + building.depth + 35 });
    window.setTimeout(() => {
      onVisit(building);
      onEnterBuilding(building.name, building.id);
    }, 0);
  }

  return (
    <>
      <Atmosphere hour={hour} />
            {/* ✅ MapControls for locked-angle 2D panning */}
      <MapControls
        makeDefault
        enabled={active && interactive}
        enableRotate={false}       // 🔒 Prevents looking up/down into the sky
        enablePan={true}           // 🖐️ Allows dragging left/right/up/down
        enableZoom={true}          // 🔍 Allows zooming in/out
        screenSpacePanning={true}  // Makes the drag follow your mouse perfectly
        minDistance={400}
        maxDistance={3500}
        minPolarAngle={Math.PI / 3.5} 
        maxPolarAngle={Math.PI / 3.5}
        target={[0, 0, 0]}
        touches={{
          ONE: THREE.TOUCH.PAN,      // ☝️ One finger drags the map
          TWO: THREE.TOUCH.DOLLY_PAN // ✌️ Two fingers zoom
        }}
      />
      <FocusOnPlayer active={active && interactive} focus={playerFocus} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -48, 0]}>
        <planeGeometry args={[10000, 10000]} /><meshStandardMaterial map={oceanTexture} color="#d2e3e3" roughness={0.42} metalness={0.12} />
      </mesh>
      <mesh geometry={cliffGeometry} receiveShadow castShadow>
        <meshStandardMaterial color="#88765b" roughness={1} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={beachGeometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.4, 0]} receiveShadow>
        <meshStandardMaterial color="#d6c18e" roughness={1} />
      </mesh>
      <mesh geometry={islandGeometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
        <meshStandardMaterial map={grassTexture} roughness={1} />
      </mesh>
      <InstancedNeighborhood />

      <Road length={2550} width={98} position={[0, 0, -370]} rotation={UPPER_ROAD_TILT} crossings={[822]} asphalt={asphaltTexture} />
      <Road length={2550} width={90} position={[0, 0, 570]} rotation={LOWER_ROAD_TILT} crossings={[822]} asphalt={asphaltTexture} />
      <Road length={1500} width={38} position={[822, 0, -20]} rotation={Math.PI / 2} crossings={[-350, 590]} asphalt={asphaltTexture} />

      <mesh geometry={riverGeometry} receiveShadow><meshStandardMaterial color="#347f91" roughness={0.5} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={riverGeometry} position={[0, 1.4, 0]}><meshStandardMaterial color="#52b3c4" roughness={0.24} metalness={0.08} side={THREE.DoubleSide} /></mesh>

      {RIVER_BRIDGES.map((bridge) => <RiverBridge key={bridge.position[2]} {...bridge} />)}
      <StreetLamps />
      <CityTraffic />
      <CityPeople />
      {TREES.map((tree, index) => <Tree key={index} {...tree} scale={0.9 + (index % 3) * 0.16} />)}
      <Grove />

      {PLACED_BUILDINGS.map((building) => (
        <Landmark
          key={building.id}
          building={building}
          selected={selected === building.id}
          onVisit={visit}
        />
      ))}
      {BILLBOARDS.map((board) => <Billboard key={board.title} board={board} />)}
      <AnimatedPlayer destination={destination} appearance={appearance} />
    </>
  );
}

type Rect = { x1: number; y1: number; x2: number; y2: number };

function footprintOf(building: Building): Rect {
  const pad = building.kind === "market" ? 12 : building.kind === "tower" ? 10 : 2;
  return {
    x1: building.x - pad,
    y1: building.y - pad,
    x2: building.x + building.width + pad,
    y2: building.y + building.depth + pad,
  };
}

function rectGap(a: Rect, b: Rect) {
  const dx = Math.max(a.x1 - b.x2, b.x1 - a.x2, 0);
  const dy = Math.max(a.y1 - b.y2, b.y1 - a.y2, 0);
  return Math.hypot(dx, dy);
}

function findCrowdedBuildings() {
  const problems: string[] = [];
  for (let i = 0; i < PLACED_BUILDINGS.length; i += 1) {
    for (let j = i + 1; j < PLACED_BUILDINGS.length; j += 1) {
      const gap = rectGap(footprintOf(PLACED_BUILDINGS[i]), footprintOf(PLACED_BUILDINGS[j]));
      if (gap < MIN_BUILDING_GAP) {
        problems.push(`${PLACED_BUILDINGS[i].name} <-> ${PLACED_BUILDINGS[j].name} (${Math.round(gap)} apart)`);
      }
    }
  }
  return problems;
}

function CanvasSizer({ containerRef }: { containerRef: { current: HTMLDivElement | null } }) {
  const { gl, setSize } = useThree();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      setSize(width, height);
      gl.setSize(width, height, false);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    return () => observer.disconnect();
  }, [containerRef, gl, setSize]);

  return null;
}

export default function OsogboScene({
  active,
  interactive = true,
  appearance = DEFAULT_CHARACTER_APPEARANCE,
  onEnterBuilding,
}: {
  active: boolean;
  interactive?: boolean;
  appearance?: CharacterAppearance;
  onEnterBuilding: (buildingName: string, buildingId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);

  const devOffsetMs = useGameStore((state) => state.devOffsetMs);
  const now = useNow(1000);
  const clock = getGameClock(now + devOffsetMs) as unknown as { hour: number; minute?: number; minutes?: number };
  const rawHour = Math.floor(clock.hour) + (clock.minute ?? clock.minutes ?? 0) / 60;
  const hour = Number.isFinite(rawHour) ? rawHour : 12;

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const hidden = BUILDINGS.filter((building) => !PLACED_BUILDINGS.includes(building)).map((building) => building.name);
    if (hidden.length) console.warn("[OsogboScene] Not shown because they touch the river:", hidden.join(", "));
    // Crowded-building warnings intentionally disabled — visual overlaps are acceptable.
  }, []);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 z-0 ${active ? "" : "invisible pointer-events-none"} ${interactive ? "" : "pointer-events-none"}`}
      aria-label={interactive ? "Interactive 3D map of Osogbo" : "Osogbo 3D city preview"}
      aria-hidden={!active}
    >
      <Canvas
        shadows
        style={{ width: "100%", height: "100%" }}
        dpr={[1, 1.5]}
        camera={{ position: [0, 2450, 2350], rotation: [-Math.PI / 4, 0, 0], fov: 45, near: 1, far: 12000 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor("#4babc0");
          gl.shadowMap.type = THREE.PCFShadowMap;
        }}
      >
        <CanvasSizer containerRef={containerRef} />
        <Scene
          active={active}
          interactive={interactive}
          hour={hour}
          appearance={appearance}
          onVisit={(building) => setSelectedBuilding(building.id)}
          onEnterBuilding={onEnterBuilding}
        />
      </Canvas>

      <span className="sr-only" aria-live="polite">{selectedBuilding ? `Selected ${selectedBuilding}` : "Osogbo map"}</span>
    </div>
  );
}