import type { HousingPlanId } from "@/lib/housing";

export type ApartmentPoint = readonly [x: number, z: number];

export type RoomKind =
  | "studio" | "living" | "bedroom" | "kitchen"
  | "bathroom" | "utility" | "balcony" | "corridor";

export type ApartmentRoom = {
  id: string; name: string; kind: RoomKind;
  x: number; z: number; width: number; depth: number;
  floorLight: string; floorDark?: string;
  tileSize?: number; gridRows?: number; gridCols?: number;
};

export type ApartmentWall = {
  id: string; start: ApartmentPoint; end: ApartmentPoint;
  height: number; thickness: number;
  style?: "wall" | "glass" | "railing";
};

export type ApartmentOpening = {
  wallId: string; position: number; width: number; height: number;
  type: "door" | "window" | "arch" | "open";
  sillHeight?: number; paneColumns?: number; paneRows?: number;
};

export type ApartmentFloorBounds = {
  id: string; name: string;
  minX: number; maxX: number; minZ: number; maxZ: number;
};

export type ApartmentCamera = { target: [number, number, number]; zoom: number; };

export type ApartmentLayout = {
  id: HousingPlanId; name: string;
  rooms: ApartmentRoom[]; walls: ApartmentWall[]; openings: ApartmentOpening[];
  floorBounds: ApartmentFloorBounds[]; camera: ApartmentCamera;
};

export const APARTMENT_SIZE = {
  width: 16, depth: 8, wallHeight: 3,
  partitionHeight: 1.35, wallThickness: 0.03,
};

export const DEFAULT_TILE_SIZE = 1;
export const SELF_CON_MIN_GRID_ROWS = 15;
export const LARGER_APARTMENT_MIN_GRID_ROWS = 20;

// ── PER-APARTMENT COLORS ───────────────────────────────────────────────────
export const TWO_BED_WALL_COLOR = "#9ca3a8";
export const TWO_BED_TILE_LIGHT = "#c19a6b";
export const TWO_BED_TILE_DARK = "#a87b4b";
export const TWO_BED_KITCHEN_LIGHT = "#b8b8b8";
export const TWO_BED_KITCHEN_DARK = "#a0a0a0";

export const PARLOUR_WALL_COLOR = "#2e7d5a";
export const PARLOUR_TILE_LIGHT = "#c19a6b";
export const PARLOUR_TILE_DARK = "#a87b4b";

export const SELF_CON_WALL_COLOR = "#d4c5a9";
export const SELF_CON_TILE_LIGHT = "#c19a6b";
export const SELF_CON_TILE_DARK = "#a87b4b";

export const APARTMENT_SKIRTING_COLOR = "#1a1a1a";
export const APARTMENT_TOP_EDGE_COLOR = "#3a3a3a";
export const APARTMENT_GLASS_COLOR = "#a4d1d8";

const WALL_H = APARTMENT_SIZE.wallHeight;
const PART_H = APARTMENT_SIZE.partitionHeight;
const WALL_T = APARTMENT_SIZE.wallThickness;

function boundsOf(rooms: ApartmentRoom[]): ApartmentFloorBounds[] {
  return rooms.map((r) => ({
    id: r.id, name: r.name,
    minX: r.x, maxX: r.x + r.width, minZ: r.z, maxZ: r.z + r.depth,
  }));
}

function withGrid(room: ApartmentRoom, minRows: number): ApartmentRoom {
  const tileSize = room.tileSize ?? DEFAULT_TILE_SIZE;
  return {
    ...room, tileSize,
    gridRows: Math.max(minRows, Math.ceil(room.depth / tileSize)),
    gridCols: Math.ceil(room.width / tileSize),
  };
}

/* ========================================================================== */
/* 2-BEDROOM                                                                  */
/* ========================================================================== */

const TWO_BEDROOM_ROOMS: ApartmentRoom[] = ([
  { id: "living", name: "Living Room", kind: "living", x: -8, z: 10, width: 10, depth: 15,
    floorLight: TWO_BED_TILE_LIGHT, floorDark: TWO_BED_TILE_DARK },
  { id: "bedroom-1", name: "Bedroom 1", kind: "bedroom", x: -8, z: 0, width: 12, depth: 10,
    floorLight: TWO_BED_TILE_LIGHT, floorDark: TWO_BED_TILE_DARK },
  { id: "bedroom-2", name: "Bedroom 2", kind: "bedroom", x: 2, z: 10, width: 12, depth: 15,
    floorLight: TWO_BED_TILE_LIGHT, floorDark: TWO_BED_TILE_DARK },
  { id: "kitchen", name: "Kitchen", kind: "kitchen", x: 4, z: 0, width: 10, depth: 10,
    floorLight: TWO_BED_KITCHEN_LIGHT, floorDark: TWO_BED_KITCHEN_DARK },
] satisfies ApartmentRoom[]).map((r) => withGrid(r, LARGER_APARTMENT_MIN_GRID_ROWS));

const TWO_BEDROOM_WALLS: ApartmentWall[] = [
  { id: "front", start: [-8, 25], end: [14, 25], height: 0.4, thickness: WALL_T },
  { id: "back", start: [-8, 0], end: [14, 0], height: WALL_H, thickness: WALL_T },
  { id: "left", start: [-8, 0], end: [-8, 25], height: WALL_H, thickness: WALL_T },
  { id: "right", start: [14, 0], end: [14, 25], height: 0.4, thickness: WALL_T },
  { id: "bedroom-divider", start: [-8, 10], end: [4, 10], height: PART_H, thickness: WALL_T },
  { id: "bedroom-partition", start: [4, 0], end: [4, 10], height: PART_H, thickness: WALL_T },
  { id: "living-partition", start: [5, 10], end: [5, 25], height: PART_H, thickness: WALL_T },
  { id: "kitchen-divider", start: [5, 10], end: [12, 10], height: PART_H, thickness: WALL_T },
];

const TWO_BEDROOM_OPENINGS: ApartmentOpening[] = [
  { wallId: "left", position: 23, width: 1.2, height: 2.2, type: "door" },
  { wallId: "back", position: 5, width: 2.0, height: 1.8, sillHeight: 0.5, type: "window", paneColumns: 3, paneRows: 2 },
  { wallId: "back", position: 18, width: 2.0, height: 1.8, sillHeight: 0.5, type: "window", paneColumns: 3, paneRows: 2 },
];

const TWO_BEDROOM_LAYOUT: ApartmentLayout = {
  id: "two-bedroom", name: "2-bedroom flat",
  rooms: TWO_BEDROOM_ROOMS, walls: TWO_BEDROOM_WALLS, openings: TWO_BEDROOM_OPENINGS,
  floorBounds: boundsOf(TWO_BEDROOM_ROOMS),
  camera: { target: [0, 0, 5], zoom: 32 },
};

/* ========================================================================== */
/* ROOM & PARLOUR                                                             */
/* ========================================================================== */

const PARLOUR_ROOMS: ApartmentRoom[] = ([
  { id: "parlour", name: "Parlour", kind: "living", x: -5, z: 8, width: 9, depth: 10,
    floorLight: TWO_BED_KITCHEN_LIGHT, floorDark: TWO_BED_KITCHEN_DARK },
  { id: "bedroom", name: "Bedroom", kind: "bedroom", x: -5, z: 0, width: 7, depth: 8,
    floorLight: PARLOUR_TILE_LIGHT, floorDark: PARLOUR_TILE_DARK },
  { id: "kitchen", name: "Kitchen", kind: "kitchen", x: 2, z: 0, width: 6, depth: 8,
    floorLight: TWO_BED_KITCHEN_LIGHT, floorDark: TWO_BED_KITCHEN_DARK },
  { id: "bathroom", name: "Bathroom", kind: "bathroom", x: 4, z: 8, width: 4, depth: 10,
    floorLight: PARLOUR_TILE_LIGHT, floorDark: PARLOUR_TILE_DARK },
] satisfies ApartmentRoom[]).map((r) => withGrid(r, LARGER_APARTMENT_MIN_GRID_ROWS));

const PARLOUR_WALLS: ApartmentWall[] = [
  { id: "front", start: [-5, 18], end: [8, 18], height: 0.4, thickness: WALL_T },
  { id: "back", start: [-5, 0], end: [8, 0], height: WALL_H, thickness: WALL_T },
  { id: "left", start: [-5, 0], end: [-5, 18], height: WALL_H, thickness: WALL_T },
  { id: "right", start: [8, 0], end: [8, 18], height: 0.4, thickness: WALL_T },
  { id: "parlour-partition", start: [-1, 8], end: [3, 8], height: PART_H, thickness: WALL_T },
  { id: "bed-kitchen-partition", start: [2, 0], end: [2, 8], height: PART_H, thickness: WALL_T },
  { id: "bed-partition", start: [-5, 8], end: [-2, 8], height: PART_H, thickness: WALL_T },
  { id: "bath-partition", start: [4, 14], end: [4, 18], height: PART_H, thickness: WALL_T },
  { id: "parlour-bath-partition", start: [4, 8], end: [4, 13], height: PART_H, thickness: WALL_T },
  { id: "bath-kitchen-divider", start: [4, 8], end: [8, 8], height: PART_H, thickness: WALL_T },
];

const PARLOUR_OPENINGS: ApartmentOpening[] = [
  { wallId: "left", position: 16, width: 1.1, height: 2.2, type: "door" },
  
  { wallId: "back", position: 3, width: 1.8, height: 1.6, sillHeight: 0.5, type: "window", paneColumns: 2, paneRows: 2 },
  { wallId: "back", position: 11, width: 1.5, height: 1.6, sillHeight: 0.5, type: "window", paneColumns: 2, paneRows: 2 },
];

const PARLOUR_LAYOUT: ApartmentLayout = {
  id: "room-parlour", name: "Room & parlour self-con",
  rooms: PARLOUR_ROOMS, walls: PARLOUR_WALLS, openings: PARLOUR_OPENINGS,
  floorBounds: boundsOf(PARLOUR_ROOMS),
  camera: { target: [0.5, 0, 4], zoom: 32 },
};

/* ========================================================================== */
/* SELF-CON (17×15 with open wall gaps)                                       */
/* ========================================================================== */

const SELF_CON_ROOMS: ApartmentRoom[] = ([
  { id: "studio", name: "Main Room", kind: "studio", x: -4, z: 0, width: 12, depth: 15,
    floorLight: SELF_CON_TILE_LIGHT, floorDark: SELF_CON_TILE_DARK },
  { id: "kitchen", name: "Kitchen", kind: "kitchen", x: 8, z: 0, width: 5, depth: 9,
    floorLight: TWO_BED_KITCHEN_LIGHT, floorDark: TWO_BED_KITCHEN_DARK },
  { id: "bathroom", name: "Bathroom", kind: "bathroom", x: 8, z: 9, width: 5, depth: 6,
    floorLight: TWO_BED_KITCHEN_LIGHT, floorDark: TWO_BED_KITCHEN_DARK },
] satisfies ApartmentRoom[]).map((r) => withGrid(r, SELF_CON_MIN_GRID_ROWS));

const SELF_CON_WALLS: ApartmentWall[] = [
  // Outer walls
  { id: "back", start: [-4, 0], end: [13, 0], height: WALL_H, thickness: WALL_T },
  { id: "front", start: [-4, 15], end: [13.3, 15], height: 0.3, thickness: WALL_T },
  { id: "left", start: [-4, 0], end: [-4, 15], height: WALL_H, thickness: WALL_T },
  { id: "right", start: [13.2, 0], end: [13.2, 15], height: 0.3, thickness: WALL_T },

  // ✅ Partition wall BROKEN into two pieces to create open gaps:
  // Bottom piece (bathroom): from z=0 to z=1.5 (wall stops, gap begins)
  { id: "wet-partition-1", start: [8, 0], end: [8, 5], height: 1.5, thickness: WALL_T },
  
  // Middle piece (between bathroom and kitchen): from z=4.5 to z=10.5
  { id: "wet-partition-2", start: [8, 7], end: [8, 10.5], height: 1.5, thickness: WALL_T },
  
  // Top piece (kitchen): from z=13.5 to z=15
  { id: "wet-partition-3", start: [8, 12], end: [8, 15], height: 1.5, thickness: WALL_T },

  // Divider between bathroom and kitchen
  { id: "bath-kitchen-divider", start: [8, 9], end: [13, 9], height: 1, thickness: WALL_T },
];

const SELF_CON_OPENINGS: ApartmentOpening[] = [
  // Main entrance door (on the left wall)
  { wallId: "left", position: 12.5, width: 1.1, height: 2.2, type: "door" },

  // Note: No openings for bathroom/kitchen - the wall gaps ARE the entrance
  // (No doors, no frames, just empty floor where the wall stops)

  // Windows on back wall
  { wallId: "back", position: 5, width: 2.0, height: 1.6, sillHeight: 0.5, type: "window", paneColumns: 3, paneRows: 2 },
  { wallId: "back", position: 15, width: 1.5, height: 1.6, sillHeight: 0.5, type: "window", paneColumns: 2, paneRows: 2 },
];

const SELF_CON_LAYOUT: ApartmentLayout = {
  id: "self-con", name: "Self-con",
  rooms: SELF_CON_ROOMS, walls: SELF_CON_WALLS, openings: SELF_CON_OPENINGS,
  floorBounds: boundsOf(SELF_CON_ROOMS),
  camera: { target: [4.5, 0, 7.5], zoom: 32 },
};

/* ========================================================================== */

export const APARTMENT_LAYOUTS: Record<HousingPlanId, ApartmentLayout> = {
  "self-con": SELF_CON_LAYOUT,
  "room-parlour": PARLOUR_LAYOUT,
  "two-bedroom": TWO_BEDROOM_LAYOUT,
};

export function getApartmentLayout(plan: HousingPlanId): ApartmentLayout {
  return APARTMENT_LAYOUTS[plan];
}
export const APARTMENT_ROOMS = TWO_BEDROOM_LAYOUT.rooms;
export const APARTMENT_WALLS = TWO_BEDROOM_LAYOUT.walls;
export const APARTMENT_OPENINGS = TWO_BEDROOM_LAYOUT.openings;
export const APARTMENT_FLOOR_BOUNDS = TWO_BEDROOM_LAYOUT.floorBounds;