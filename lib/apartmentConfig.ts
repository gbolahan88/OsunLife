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
  gridRows?: number;
  gridCols?: number;

  /** 0 = ground floor, 1 = upper floor. */
  floorLevel?: number;
};

export type ApartmentWall = {
  id: string;
  start: ApartmentPoint;
  end: ApartmentPoint;
  height: number;
  thickness: number;
  style?: "wall" | "glass" | "railing";

  /** 0 = ground floor, 1 = upper floor. */
  floorLevel?: number;
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
  floorLevel?: number;
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
  depth: 12,
  wallHeight: 3,
  partitionHeight: 1.35,
  wallThickness: 0.16,
};

export const DEFAULT_TILE_SIZE = 0.6;
export const SELF_CON_MIN_GRID_ROWS = 15;
export const LARGER_APARTMENT_MIN_GRID_ROWS = 20;

/* -------------------------------------------------------------------------- */
/* Colours                                                                     */
/* -------------------------------------------------------------------------- */

export const APARTMENT_WALL_COLOR = "#e3d4ba";
export const APARTMENT_SKIRTING_COLOR = "#c4b08f";
export const APARTMENT_TOP_EDGE_COLOR = "#f9f0e0";
export const APARTMENT_GLASS_COLOR = "#a4d1d8";

/**
 * Colour used for the solid platform that is rendered under any room
 * whose `elevation` is greater than zero (e.g. the upper-floor bedroom).
 * Slightly darker / warmer than the wall colour so the raised base reads
 * as a distinct "step up" from the ground floor.
 */
export const APARTMENT_PLATFORM_COLOR = "#b8a688";

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
    floorLevel: room.floorLevel ?? 0,
  }));
}

function withGrid(
  room: ApartmentRoom,
  minimumRows: number,
): ApartmentRoom {
  const tileSize = room.tileSize ?? DEFAULT_TILE_SIZE;

  return {
    ...room,
    tileSize,
    gridRows: Math.max(
      minimumRows,
      Math.ceil(room.depth / tileSize),
    ),
    gridCols: Math.ceil(room.width / tileSize),
  };
}

/* -------------------------------------------------------------------------- */
/* SELF-CONTAINED APARTMENT                                                    */
/* One studio room, separate kitchen, separate bathroom/toilet.                */
/* -------------------------------------------------------------------------- */

const SELF_CON_ROOMS: ApartmentRoom[] = (
  [
    {
      id: "studio",
      name: "Room",
      kind: "studio",
      x: -4,
      z: 0,
      width: 8,
      depth: 7,
      floorLight: "#f1ece0",
      floorDark: "#dbd4c4",
    },
    {
      id: "kitchenette",
      name: "Kitchen",
      kind: "kitchen",
      x: 4,
      z: 0,
      width: 3,
      depth: 3.5,
      floorLight: "#ecebe5",
      floorDark: "#d5d6d0",
    },
    {
      id: "bathroom",
      name: "Bathroom / Toilet",
      kind: "bathroom",
      x: 4,
      z: 3.5,
      width: 3,
      depth: 3.5,
      floorLight: "#cbdde0",
      floorDark: "#b4cbd0",
    },
  ] satisfies ApartmentRoom[]
).map((room) => withGrid(room, SELF_CON_MIN_GRID_ROWS));

const SELF_CON_WALLS: ApartmentWall[] = [
  { id: "back", start: [-4, 0], end: [7, 0], height: WALL_H, thickness: WALL_T },
  { id: "left", start: [-4, 0], end: [-4, 7], height: WALL_H, thickness: WALL_T },
  { id: "right", start: [7, 0], end: [7, 7], height: WALL_H, thickness: WALL_T },
  { id: "front", start: [-4, 7], end: [7, 7], height: WALL_H, thickness: WALL_T },

  {
    id: "wet-partition",
    start: [4, 0],
    end: [4, 7],
    height: PART_H,
    thickness: 0.14,
  },
  {
    id: "bath-kitchen-divider",
    start: [4, 3.5],
    end: [7, 3.5],
    height: PART_H,
    thickness: 0.14,
  },
];

const SELF_CON_OPENINGS: ApartmentOpening[] = [
  { wallId: "front", position: 2, width: 1.1, height: 2.2, type: "door" },

  { wallId: "back", position: 2.5, width: 1.7, height: 1.2, sillHeight: 0.9, type: "window", paneColumns: 2, paneRows: 2 },

  { wallId: "wet-partition", position: 1.75, width: 0.9, height: 2.1, type: "door" },
  { wallId: "bath-kitchen-divider", position: 1.5, width: 0.85, height: 2.1, type: "door" },
];

const SELF_CON_LAYOUT: ApartmentLayout = {
  id: "self-con",
  name: "Self-contained apartment",
  rooms: SELF_CON_ROOMS,
  walls: SELF_CON_WALLS,
  openings: SELF_CON_OPENINGS,
  floorBounds: boundsOf(SELF_CON_ROOMS),
  camera: { target: [1.5, 0, 3.5], zoom: 32 },
};

/* -------------------------------------------------------------------------- */
/* ROOM AND PARLOUR                                                            */
/* Living room, separate bedroom, kitchen and bathroom/toilet.                  */
/* -------------------------------------------------------------------------- */

const ROOM_PARLOUR_ROOMS: ApartmentRoom[] = (
  [
    {
      id: "parlour",
      name: "Living room",
      kind: "living",
      x: -7,
      z: 0,
      width: 7,
      depth: 6,
      floorLight: "#f4f0e5",
      floorDark: "#ded9cd",
    },
    {
      id: "bedroom",
      name: "Bedroom",
      kind: "bedroom",
      x: 0,
      z: 0,
      width: 5,
      depth: 4.5,
      floorLight: "#c59c6e",
      floorDark: "#a77d55",
    },
    {
      id: "kitchen",
      name: "Kitchen",
      kind: "kitchen",
      x: 0,
      z: 4.5,
      width: 3,
      depth: 3,
      floorLight: "#ecebe5",
      floorDark: "#d5d6d0",
    },
    {
      id: "bathroom",
      name: "Bathroom / Toilet",
      kind: "bathroom",
      x: 3,
      z: 4.5,
      width: 2,
      depth: 3,
      floorLight: "#cbdde0",
      floorDark: "#b4cbd0",
    },
  ] satisfies ApartmentRoom[]
).map((room) => withGrid(room, LARGER_APARTMENT_MIN_GRID_ROWS));

const ROOM_PARLOUR_WALLS: ApartmentWall[] = [
  { id: "back", start: [-7, 0], end: [5, 0], height: WALL_H, thickness: WALL_T },
  { id: "left", start: [-7, 0], end: [-7, 7.5], height: WALL_H, thickness: WALL_T },
  { id: "right", start: [5, 0], end: [5, 7.5], height: WALL_H, thickness: WALL_T },
  { id: "front", start: [-7, 7.5], end: [5, 7.5], height: WALL_H, thickness: WALL_T },

  {
    id: "parlour-partition",
    start: [0, 0],
    end: [0, 7.5],
    height: PART_H,
    thickness: 0.14,
  },
  {
    id: "bed-kitchen-divider",
    start: [0, 4.5],
    end: [5, 4.5],
    height: PART_H,
    thickness: 0.14,
  },
  {
    id: "wet-divider",
    start: [3, 4.5],
    end: [3, 7.5],
    height: PART_H,
    thickness: 0.14,
  },
];

const ROOM_PARLOUR_OPENINGS: ApartmentOpening[] = [
  { wallId: "front", position: 3, width: 1.1, height: 2.2, type: "door" },

  { wallId: "parlour-partition", position: 3, width: 1.4, height: PART_H, type: "open" },
  { wallId: "bed-kitchen-divider", position: 2.5, width: 0.95, height: 2.1, type: "door" },
  { wallId: "wet-divider", position: 1.5, width: 0.85, height: 2.1, type: "door" },

  { wallId: "back", position: 3, width: 1.6, height: 1.2, sillHeight: 0.9, type: "window", paneColumns: 2, paneRows: 2 },
  { wallId: "right", position: 2, width: 1.4, height: 1.3, sillHeight: 0.9, type: "window", paneColumns: 2, paneRows: 2 },
];

const ROOM_PARLOUR_LAYOUT: ApartmentLayout = {
  id: "room-parlour",
  name: "Room and parlour",
  rooms: ROOM_PARLOUR_ROOMS,
  walls: ROOM_PARLOUR_WALLS,
  openings: ROOM_PARLOUR_OPENINGS,
  floorBounds: boundsOf(ROOM_PARLOUR_ROOMS),
  camera: { target: [-1, 0, 3.5], zoom: 29 },
};

/* -------------------------------------------------------------------------- */
/* TWO-BEDROOM APARTMENT                                                       */
/* Ground floor: living room, kitchen, bathroom, staircase and balcony.         */
/* Upper floor: one large bedroom.                                              */
/* -------------------------------------------------------------------------- */

const TWO_BEDROOM_ROOMS: ApartmentRoom[] = (
  [
    {
      id: "living-room",
      name: "Living room",
      kind: "living",
      x: -8,
      z: 0,
      width: 8,
      depth: 8,
      floorLight: "#f2e9d8",
      floorDark: "#e8dac3",
    },
    {
      id: "kitchen",
      name: "Large kitchen",
      kind: "kitchen",
      x: 0,
      z: 0,
      width: 5,
      depth: 4.5,
      floorLight: "#ecebe5",
      floorDark: "#d5d6d0",
    },
    {
      id: "bathroom",
      name: "Bathroom / Toilet",
      kind: "bathroom",
      x: 5,
      z: 0,
      width: 3,
      depth: 4.5,
      floorLight: "#cbdde0",
      floorDark: "#b4cbd0",
    },
    {
      id: "staircase",
      name: "Staircase",
      kind: "corridor",
      x: -2,
      z: 4.5,
      width: 4,
      depth: 3.5,
      floorLight: "#d5c2a4",
      floorDark: "#bca486",
    },
    {
      id: "balcony",
      name: "Balcony",
      kind: "balcony",
      x: -8,
      z: 8,
      width: 8,
      depth: 2,
      floorLight: "#cfcfc7",
    },
    {
      id: "bedroom-1",
      name: "Large upstairs bedroom",
      kind: "bedroom",
      x: -4,
      z: 0,
      width: 8,
      depth: 7,
      floorLight: "#c59c6e",
      floorDark: "#a77d55",
      floorLevel: 1,
    },
  ] satisfies ApartmentRoom[]
).map((room) => withGrid(room, LARGER_APARTMENT_MIN_GRID_ROWS));

const TWO_BEDROOM_WALLS: ApartmentWall[] = [
  // Ground-floor external walls.
  { id: "back", start: [-8, 0], end: [8, 0], height: WALL_H, thickness: WALL_T },
  { id: "left", start: [-8, 0], end: [-8, 8], height: WALL_H, thickness: WALL_T },
  { id: "right", start: [8, 0], end: [8, 8], height: WALL_H, thickness: WALL_T },

  // Ground-floor partitions.
  { id: "living-partition", start: [0, 0], end: [0, 8], height: PART_H, thickness: 0.14 },
  { id: "wet-divider", start: [5, 0], end: [5, 4.5], height: PART_H, thickness: 0.14 },
  { id: "kitchen-bath-divider", start: [0, 4.5], end: [8, 4.5], height: PART_H, thickness: 0.14 },

  // Balcony railing.
  { id: "balcony-front-rail", start: [-8, 10], end: [0, 10], height: 1.05, thickness: 0.1, style: "railing" },
  { id: "balcony-left-rail", start: [-8, 8], end: [-8, 10], height: 1.05, thickness: 0.1, style: "railing" },
  { id: "balcony-right-rail", start: [0, 8], end: [0, 10], height: 1.05, thickness: 0.1, style: "railing" },

  // Upstairs bedroom walls.
  { id: "upstairs-back", start: [-4, 0], end: [4, 0], height: WALL_H, thickness: WALL_T, floorLevel: 1 },
  { id: "upstairs-left", start: [-4, 0], end: [-4, 7], height: WALL_H, thickness: WALL_T, floorLevel: 1 },
  { id: "upstairs-right", start: [4, 0], end: [4, 7], height: WALL_H, thickness: WALL_T, floorLevel: 1 },
  { id: "upstairs-front", start: [-4, 7], end: [4, 7], height: WALL_H, thickness: WALL_T, floorLevel: 1 },
];

const TWO_BEDROOM_OPENINGS: ApartmentOpening[] = [
  { wallId: "left", position: 7, width: 1.2, height: 2.2, type: "door" },

  { wallId: "living-partition", position: 3, width: 1.6, height: PART_H, type: "open" },
  { wallId: "kitchen-bath-divider", position: 2.5, width: 1.0, height: 2.1, type: "door" },
  { wallId: "kitchen-bath-divider", position: 6.5, width: 1.0, height: 2.1, type: "door" },

  { wallId: "back", position: -3, width: 1.6, height: 1.4, sillHeight: 0.8, type: "window", paneColumns: 2, paneRows: 2 },
  { wallId: "back", position: 2.5, width: 1.6, height: 1.4, sillHeight: 0.8, type: "window", paneColumns: 2, paneRows: 2 },
  { wallId: "right", position: 2, width: 1.3, height: 1.4, sillHeight: 0.8, type: "window", paneColumns: 2, paneRows: 2 },

  { wallId: "upstairs-back", position: 2, width: 1.8, height: 1.4, sillHeight: 0.8, type: "window", paneColumns: 2, paneRows: 2 },
  { wallId: "upstairs-right", position: 3.5, width: 1.5, height: 1.4, sillHeight: 0.8, type: "window", paneColumns: 2, paneRows: 2 },
];

const TWO_BEDROOM_LAYOUT: ApartmentLayout = {
  id: "two-bedroom",
  name: "Two-bedroom apartment",
  rooms: TWO_BEDROOM_ROOMS,
  walls: TWO_BEDROOM_WALLS,
  openings: TWO_BEDROOM_OPENINGS,
  floorBounds: boundsOf(TWO_BEDROOM_ROOMS),
  camera: { target: [0, 0, 4], zoom: 24 },
};

/* -------------------------------------------------------------------------- */
/* PUBLIC CONFIGURATION                                                        */
/* -------------------------------------------------------------------------- */

export const APARTMENT_LAYOUTS: Record<HousingPlanId, ApartmentLayout> = {
  "self-con": SELF_CON_LAYOUT,
  "room-parlour": ROOM_PARLOUR_LAYOUT,
  "two-bedroom": TWO_BEDROOM_LAYOUT,
};

export function getApartmentLayout(
  plan: HousingPlanId,
): ApartmentLayout {
  return APARTMENT_LAYOUTS[plan];
}

export const APARTMENT_ROOMS = TWO_BEDROOM_LAYOUT.rooms;
export const APARTMENT_WALLS = TWO_BEDROOM_LAYOUT.walls;
export const APARTMENT_OPENINGS = TWO_BEDROOM_LAYOUT.openings;
export const APARTMENT_FLOOR_BOUNDS = TWO_BEDROOM_LAYOUT.floorBounds;