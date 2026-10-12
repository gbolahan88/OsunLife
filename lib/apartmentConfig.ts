import type { HousingPlanId } from "@/lib/housing";

export type ApartmentPoint = readonly [x: number, z: number];

export type RoomKind =
  | "studio"
  | "living"
  | "bedroom"
  | "kitchen"
  | "bathroom"
  | "utility"
  | "balcony"
  | "corridor";

export type ApartmentRoom = {
  id: string;
  name: string;
  kind: RoomKind;
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

export type ApartmentFloorBounds = {
  id: string;
  name: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type ApartmentCamera = {
  target: [number, number, number];
  zoom: number;
};

export type ApartmentLayout = {
  id: HousingPlanId;
  name: string;
  rooms: ApartmentRoom[];
  walls: ApartmentWall[];
  openings: ApartmentOpening[];
  floorBounds: ApartmentFloorBounds[];
  camera: ApartmentCamera;
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

const WALL_H = APARTMENT_SIZE.wallHeight;
const PART_H = APARTMENT_SIZE.partitionHeight;
const WALL_T = APARTMENT_SIZE.wallThickness;

function boundsOf(rooms: ApartmentRoom[]): ApartmentFloorBounds[] {
  return rooms.map((room) => ({
    id: room.id,
    name: room.name,
    minX: room.x,
    maxX: room.x + room.width,
    minZ: room.z,
    maxZ: room.z + room.depth,
  }));
}

/* -------------------------------------------------------------------------- */
/* 2-bedroom flat (the original apartment, with the bedroom strip split in two) */
/* -------------------------------------------------------------------------- */

const TWO_BEDROOM_ROOMS: ApartmentRoom[] = [
  { id: "living-room", name: "Living room", kind: "living", x: -8, z: 0, width: 9, depth: 6, floorLight: "#f4f0e5", floorDark: "#ded9cd" },
  { id: "bedroom-1", name: "Bedroom 1", kind: "bedroom", x: -8, z: -2, width: 4, depth: 2, floorLight: "#c59c6e", floorDark: "#a77d55" },
  { id: "bedroom-2", name: "Bedroom 2", kind: "bedroom", x: -4, z: -2, width: 4, depth: 2, floorLight: "#c59c6e", floorDark: "#a77d55" },
  { id: "kitchen", name: "Kitchen", kind: "kitchen", x: 0, z: -2, width: 8, depth: 2, floorLight: "#ecebe5", floorDark: "#d5d6d0" },
  { id: "corridor-living", name: "Corridor", kind: "corridor", x: 1, z: 0, width: 2, depth: 6, floorLight: "#f4f0e5", floorDark: "#ded9cd" },
  { id: "corridor-middle", name: "Corridor", kind: "corridor", x: 3, z: 0, width: 3, depth: 1.5, floorLight: "#f4f0e5", floorDark: "#ded9cd" },
  { id: "corridor-right", name: "Corridor", kind: "corridor", x: 6, z: 0, width: 2, depth: 6, floorLight: "#f4f0e5", floorDark: "#ded9cd" },
  { id: "bathroom", name: "Bathroom", kind: "bathroom", x: 3, z: 1.5, width: 3, depth: 3, floorLight: "#cbdde0", floorDark: "#b4cbd0" },
  { id: "utility", name: "Utility", kind: "utility", x: 3, z: 4.5, width: 3, depth: 1.5, floorLight: "#c7834d", floorDark: "#a96339" },
  { id: "balcony", name: "Balcony", kind: "balcony", x: 8, z: -2, width: 3, depth: 8, floorLight: "#cfcfc7" },
];

const TWO_BEDROOM_WALLS: ApartmentWall[] = [
  { id: "back", start: [-8, -2], end: [8, -2], height: WALL_H, thickness: WALL_T },
  { id: "left", start: [-8, -2], end: [-8, 6], height: WALL_H, thickness: WALL_T },
  { id: "bedroom-partition", start: [-8, 0], end: [0, 0], height: PART_H, thickness: 0.14 },
  { id: "bedroom-divider", start: [-4, -2], end: [-4, 0], height: PART_H, thickness: 0.14 },
  { id: "living-corridor-partition", start: [1, 0], end: [1, 6], height: PART_H, thickness: 0.14 },
  { id: "kitchen-partition", start: [0, 0], end: [8, 0], height: 1.25, thickness: 0.14 },
  { id: "bathroom-glass-left", start: [3, 1.5], end: [3, 4.5], height: 1.45, thickness: 0.1, style: "glass" },
  { id: "bathroom-glass-front", start: [3, 1.5], end: [6, 1.5], height: 1.45, thickness: 0.1, style: "glass" },
  { id: "bathroom-glass-right", start: [6, 1.5], end: [6, 4.5], height: 1.45, thickness: 0.1, style: "glass" },
  { id: "utility-partition", start: [3, 4.5], end: [6, 4.5], height: PART_H, thickness: 0.14 },
  { id: "utility-corridor-partition", start: [6, 4.5], end: [6, 6], height: PART_H, thickness: 0.14 },
  { id: "balcony-back-rail", start: [8, -2], end: [11, -2], height: 1.05, thickness: 0.1, style: "railing" },
  { id: "balcony-right-rail", start: [11, -2], end: [11, 6], height: 1.05, thickness: 0.1, style: "railing" },
  { id: "balcony-front-rail", start: [8, 6], end: [11, 6], height: 1.05, thickness: 0.1, style: "railing" },
];

const TWO_BEDROOM_OPENINGS: ApartmentOpening[] = [
  { wallId: "left", position: 6.35, width: 1.05, height: 2.2, type: "door" },
  { wallId: "back", position: 2, width: 1.5, height: 1.8, sillHeight: 0.65, type: "arch" },
  { wallId: "back", position: 6, width: 1.5, height: 1.8, sillHeight: 0.65, type: "arch" },
  { wallId: "back", position: 10.15, width: 0.78, height: 1, sillHeight: 1.25, type: "window", paneColumns: 2, paneRows: 2 },
  { wallId: "back", position: 11.25, width: 0.78, height: 1, sillHeight: 1.25, type: "window", paneColumns: 2, paneRows: 2 },
  { wallId: "back", position: 12.35, width: 0.78, height: 1, sillHeight: 1.25, type: "window", paneColumns: 2, paneRows: 2 },
  { wallId: "back", position: 13.45, width: 0.78, height: 1, sillHeight: 1.25, type: "window", paneColumns: 2, paneRows: 2 },
  { wallId: "bedroom-partition", position: 2, width: 1.15, height: 1.35, type: "open" },
  { wallId: "bedroom-partition", position: 6.55, width: 1.15, height: 1.35, type: "open" },
  { wallId: "living-corridor-partition", position: 2.6, width: 1.35, height: 1.35, type: "open" },
  { wallId: "kitchen-partition", position: 1.8, width: 2, height: 1.25, type: "open" },
  { wallId: "bathroom-glass-left", position: 1.5, width: 0.9, height: 1.4, type: "open" },
  { wallId: "bathroom-glass-front", position: 1.5, width: 0.95, height: 1.4, type: "open" },
  { wallId: "bathroom-glass-right", position: 1.5, width: 0.9, height: 1.4, type: "open" },
  { wallId: "utility-partition", position: 1.45, width: 0.9, height: 1.35, type: "open" },
  { wallId: "utility-corridor-partition", position: 0.75, width: 0.85, height: 1.35, type: "open" },
];

const TWO_BEDROOM_LAYOUT: ApartmentLayout = {
  id: "two-bedroom",
  name: "2-bedroom flat",
  rooms: TWO_BEDROOM_ROOMS,
  walls: TWO_BEDROOM_WALLS,
  openings: TWO_BEDROOM_OPENINGS,
  floorBounds: boundsOf(TWO_BEDROOM_ROOMS),
  camera: { target: [1.5, 0, 1.5], zoom: 32 },
};

/* -------------------------------------------------------------------------- */
/* Room & parlour self-con                                                     */
/* -------------------------------------------------------------------------- */

const ROOM_PARLOUR_ROOMS: ApartmentRoom[] = [
  { id: "parlour", name: "Parlour", kind: "living", x: -4.2, z: -1, width: 6, depth: 4.8, floorLight: "#f4f0e5", floorDark: "#ded9cd" },
  { id: "bedroom", name: "Bedroom", kind: "bedroom", x: 1.8, z: -1, width: 3.6, depth: 3, floorLight: "#c59c6e", floorDark: "#a77d55" },
  { id: "bathroom", name: "Bathroom", kind: "bathroom", x: 1.8, z: 2, width: 3.6, depth: 1.8, floorLight: "#cbdde0", floorDark: "#b4cbd0" },
];

const ROOM_PARLOUR_WALLS: ApartmentWall[] = [
  { id: "back", start: [-4.2, -1], end: [5.4, -1], height: WALL_H, thickness: WALL_T },
  { id: "left", start: [-4.2, -1], end: [-4.2, 3.8], height: WALL_H, thickness: WALL_T },
  { id: "parlour-partition", start: [1.8, -1], end: [1.8, 3.8], height: PART_H, thickness: 0.14 },
  { id: "bed-bath-divider", start: [1.8, 2], end: [5.4, 2], height: PART_H, thickness: 0.14 },
];

const ROOM_PARLOUR_OPENINGS: ApartmentOpening[] = [
  { wallId: "left", position: 3.4, width: 1.05, height: 2.2, type: "door" },
  { wallId: "back", position: 2.4, width: 1.5, height: 1.1, sillHeight: 1, type: "window", paneColumns: 2, paneRows: 2 },
  { wallId: "back", position: 7.5, width: 1.2, height: 1.1, sillHeight: 1, type: "window", paneColumns: 2, paneRows: 2 },
  { wallId: "parlour-partition", position: 1.6, width: 1.1, height: 1.35, type: "open" },
  { wallId: "parlour-partition", position: 3.9, width: 0.9, height: 1.35, type: "open" },
];

const ROOM_PARLOUR_LAYOUT: ApartmentLayout = {
  id: "room-parlour",
  name: "Room & parlour self-con",
  rooms: ROOM_PARLOUR_ROOMS,
  walls: ROOM_PARLOUR_WALLS,
  openings: ROOM_PARLOUR_OPENINGS,
  floorBounds: boundsOf(ROOM_PARLOUR_ROOMS),
  camera: { target: [0.6, 0, 1.4], zoom: 50 },
};

/* -------------------------------------------------------------------------- */
/* Self-con                                                                    */
/* -------------------------------------------------------------------------- */

const SELF_CON_ROOMS: ApartmentRoom[] = [
  { id: "studio", name: "Self-con room", kind: "studio", x: -3, z: -1, width: 6, depth: 4.2, floorLight: "#f1ece0", floorDark: "#dbd4c4" },
  { id: "bathroom", name: "Bathroom", kind: "bathroom", x: 3, z: -1, width: 2.4, depth: 2.4, floorLight: "#cbdde0", floorDark: "#b4cbd0" },
  { id: "kitchenette", name: "Kitchenette", kind: "kitchen", x: 3, z: 1.4, width: 2.4, depth: 1.8, floorLight: "#ecebe5", floorDark: "#d5d6d0" },
];

const SELF_CON_WALLS: ApartmentWall[] = [
  { id: "back", start: [-3, -1], end: [5.4, -1], height: WALL_H, thickness: WALL_T },
  { id: "left", start: [-3, -1], end: [-3, 3.2], height: WALL_H, thickness: WALL_T },
  { id: "wet-partition", start: [3, -1], end: [3, 3.2], height: PART_H, thickness: 0.14 },
  { id: "bath-kitchen-divider", start: [3, 1.4], end: [5.4, 1.4], height: PART_H, thickness: 0.14 },
];

const SELF_CON_OPENINGS: ApartmentOpening[] = [
  { wallId: "left", position: 2.2, width: 1.05, height: 2.2, type: "door" },
  { wallId: "back", position: 3, width: 1.4, height: 1.1, sillHeight: 1, type: "window", paneColumns: 2, paneRows: 2 },
  { wallId: "back", position: 7, width: 0.78, height: 1, sillHeight: 1.25, type: "window", paneColumns: 2, paneRows: 2 },
  { wallId: "wet-partition", position: 1.2, width: 0.9, height: 1.35, type: "open" },
  { wallId: "wet-partition", position: 3.3, width: 1.2, height: 1.35, type: "open" },
];

const SELF_CON_LAYOUT: ApartmentLayout = {
  id: "self-con",
  name: "Self-con",
  rooms: SELF_CON_ROOMS,
  walls: SELF_CON_WALLS,
  openings: SELF_CON_OPENINGS,
  floorBounds: boundsOf(SELF_CON_ROOMS),
  camera: { target: [1.2, 0, 1.1], zoom: 58 },
};

/* -------------------------------------------------------------------------- */

export const APARTMENT_LAYOUTS: Record<HousingPlanId, ApartmentLayout> = {
  "self-con": SELF_CON_LAYOUT,
  "room-parlour": ROOM_PARLOUR_LAYOUT,
  "two-bedroom": TWO_BEDROOM_LAYOUT,
};

export function getApartmentLayout(plan: HousingPlanId): ApartmentLayout {
  return APARTMENT_LAYOUTS[plan];
}

// Backwards-compatible exports: these describe the 2-bedroom flat.
export const APARTMENT_ROOMS = TWO_BEDROOM_LAYOUT.rooms;
export const APARTMENT_WALLS = TWO_BEDROOM_LAYOUT.walls;
export const APARTMENT_OPENINGS = TWO_BEDROOM_LAYOUT.openings;
export const APARTMENT_FLOOR_BOUNDS = TWO_BEDROOM_LAYOUT.floorBounds;