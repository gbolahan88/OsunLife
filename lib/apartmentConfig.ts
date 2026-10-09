export type ApartmentPoint = readonly [x: number, z: number];

export type ApartmentRoom = {
  id: string;
  name: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  floorLight: string;
  floorDark?: string;
  tileSize?: number;
};

export type ApartmentWall = {
  id: string;
  start: ApartmentPoint;
  end: ApartmentPoint;
  height: number;
  thickness: number;
  style?: "wall" | "glass" | "railing";
};

export type ApartmentOpening = {
  wallId: string;
  position: number;
  width: number;
  height: number;
  type: "door" | "window" | "arch" | "open";
  sillHeight?: number;
  paneColumns?: number;
  paneRows?: number;
};

export const APARTMENT_SIZE = {
  width: 16,
  depth: 8,
  wallHeight: 3,
  partitionHeight: 1.35,
  wallThickness: 0.16,
};

export const DEFAULT_TILE_SIZE = 0.6;
export const APARTMENT_WALL_COLOR = "#e6d7bd";
export const APARTMENT_SKIRTING_COLOR = "#b69d7b";
export const APARTMENT_TOP_EDGE_COLOR = "#f4ead8";
export const APARTMENT_GLASS_COLOR = "#a9d7df";

export const APARTMENT_ROOMS: ApartmentRoom[] = [
  {
    id: "living-room",
    name: "Living room",
    x: -8,
    z: 0,
    width: 9,
    depth: 6,
    floorLight: "#f4f0e5",
    floorDark: "#ded9cd",
  },
  {
    id: "bedroom",
    name: "Bedroom",
    x: -8,
    z: -2,
    width: 8,
    depth: 2,
    floorLight: "#c59c6e",
    floorDark: "#a77d55",
  },
  {
    id: "kitchen",
    name: "Kitchen",
    x: 0,
    z: -2,
    width: 8,
    depth: 2,
    floorLight: "#ecebe5",
    floorDark: "#d5d6d0",
  },
  {
    id: "corridor-living",
    name: "Corridor",
    x: 1,
    z: 0,
    width: 2,
    depth: 6,
    floorLight: "#f4f0e5",
    floorDark: "#ded9cd",
  },
  {
    id: "corridor-middle",
    name: "Corridor",
    x: 3,
    z: 0,
    width: 3,
    depth: 1.5,
    floorLight: "#f4f0e5",
    floorDark: "#ded9cd",
  },
  {
    id: "corridor-right",
    name: "Corridor",
    x: 6,
    z: 0,
    width: 2,
    depth: 6,
    floorLight: "#f4f0e5",
    floorDark: "#ded9cd",
  },
  {
    id: "bathroom",
    name: "Bathroom",
    x: 3,
    z: 1.5,
    width: 3,
    depth: 3,
    floorLight: "#cbdde0",
    floorDark: "#b4cbd0",
  },
  {
    id: "utility",
    name: "Utility",
    x: 3,
    z: 4.5,
    width: 3,
    depth: 1.5,
    floorLight: "#c7834d",
    floorDark: "#a96339",
  },
  {
    id: "balcony",
    name: "Balcony",
    x: 8,
    z: -2,
    width: 3,
    depth: 8,
    floorLight: "#cfcfc7",
  },
];

export const APARTMENT_WALLS: ApartmentWall[] = [
  { id: "back", start: [-8, -2], end: [8, -2], height: APARTMENT_SIZE.wallHeight, thickness: APARTMENT_SIZE.wallThickness },
  { id: "left", start: [-8, -2], end: [-8, 6], height: APARTMENT_SIZE.wallHeight, thickness: APARTMENT_SIZE.wallThickness },
  { id: "bedroom-partition", start: [-8, 0], end: [0, 0], height: APARTMENT_SIZE.partitionHeight, thickness: 0.14 },
  { id: "living-corridor-partition", start: [1, 0], end: [1, 6], height: APARTMENT_SIZE.partitionHeight, thickness: 0.14 },
  { id: "kitchen-partition", start: [0, 0], end: [8, 0], height: 1.25, thickness: 0.14 },
  { id: "bathroom-glass-left", start: [3, 1.5], end: [3, 4.5], height: 1.45, thickness: 0.1, style: "glass" },
  { id: "bathroom-glass-front", start: [3, 1.5], end: [6, 1.5], height: 1.45, thickness: 0.1, style: "glass" },
  { id: "bathroom-glass-right", start: [6, 1.5], end: [6, 4.5], height: 1.45, thickness: 0.1, style: "glass" },
  { id: "utility-partition", start: [3, 4.5], end: [6, 4.5], height: APARTMENT_SIZE.partitionHeight, thickness: 0.14 },
  { id: "utility-corridor-partition", start: [6, 4.5], end: [6, 6], height: APARTMENT_SIZE.partitionHeight, thickness: 0.14 },
  { id: "balcony-back-rail", start: [8, -2], end: [11, -2], height: 1.05, thickness: 0.1, style: "railing" },
  { id: "balcony-right-rail", start: [11, -2], end: [11, 6], height: 1.05, thickness: 0.1, style: "railing" },
  { id: "balcony-front-rail", start: [8, 6], end: [11, 6], height: 1.05, thickness: 0.1, style: "railing" },
];

export const APARTMENT_OPENINGS: ApartmentOpening[] = [
  { wallId: "left", position: 6.35, width: 1.05, height: 2.2, type: "door" },
  { wallId: "back", position: 3.5, width: 1.7, height: 1.8, sillHeight: 0.65, type: "arch" },
  { wallId: "back", position: 10.15, width: 0.78, height: 1, sillHeight: 1.25, type: "window", paneColumns: 2, paneRows: 2 },
  { wallId: "back", position: 11.25, width: 0.78, height: 1, sillHeight: 1.25, type: "window", paneColumns: 2, paneRows: 2 },
  { wallId: "back", position: 12.35, width: 0.78, height: 1, sillHeight: 1.25, type: "window", paneColumns: 2, paneRows: 2 },
  { wallId: "back", position: 13.45, width: 0.78, height: 1, sillHeight: 1.25, type: "window", paneColumns: 2, paneRows: 2 },
  { wallId: "bedroom-partition", position: 6.55, width: 1.15, height: 1.35, type: "open" },
  { wallId: "living-corridor-partition", position: 2.6, width: 1.35, height: 1.35, type: "open" },
  { wallId: "kitchen-partition", position: 1.8, width: 2, height: 1.25, type: "open" },
  { wallId: "bathroom-glass-left", position: 1.5, width: 0.9, height: 1.4, type: "open" },
  { wallId: "bathroom-glass-front", position: 1.5, width: 0.95, height: 1.4, type: "open" },
  { wallId: "bathroom-glass-right", position: 1.5, width: 0.9, height: 1.4, type: "open" },
  { wallId: "utility-partition", position: 1.45, width: 0.9, height: 1.35, type: "open" },
  { wallId: "utility-corridor-partition", position: 0.75, width: 0.85, height: 1.35, type: "open" },
];

export type ApartmentFloorBounds = {
  id: string;
  name: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export const APARTMENT_FLOOR_BOUNDS: ApartmentFloorBounds[] = APARTMENT_ROOMS.map((room) => ({
  id: room.id,
  name: room.name,
  minX: room.x,
  maxX: room.x + room.width,
  minZ: room.z,
  maxZ: room.z + room.depth,
}));