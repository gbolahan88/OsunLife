import {
  DEFAULT_TILE_SIZE,
  type ApartmentLayout,
  type ApartmentRoom,
  type ApartmentWall,
  type RoomKind,
} from "@/lib/apartmentConfig";

export type FurnitureCategory =
  | "Sleep" | "Living" | "Kitchen" | "Utility" | "Bathroom" | "Decor";

export type FurnitureModelId =
  | "mattress" | "bed" | "wardrobe" | "fan" | "sofa" | "chair" | "table"
  | "tv" | "dining" | "fridge" | "cooker" | "washer" | "generator"
  | "rug" | "dispenser" | "plant"
  | "bucket" | "water-drum" | "toilet" | "rain-shower"
  | "baby-bath" | "bathtub" | "jacuzzi";

export type FurnitureItem = {
  id: string;
  name: string;
  emoji: string;
  category: FurnitureCategory;
  price: number;
  w: number;
  d: number;
  model: FurnitureModelId;
  kinds: RoomKind[];
  flat?: boolean;
  image?: string;
};

export type Rotation = 0 | 1 | 2 | 3;

export type PlacedFurniture = {
  uid: string;
  itemId: string;
  roomId: string;
  col: number;
  row: number;
  rotation: Rotation;
};

export type FurniturePosition = {
  roomId: string;
  col: number;
  row: number;
  rotation: Rotation;
};

export type PlacementResult = { ok: boolean; reason?: string };

export const FURNITURE_CATALOG: FurnitureItem[] = [
  // ── SLEEP ──
  { id: "foam-mattress", name: "Foam mattress", emoji: "🛏️", category: "Sleep", price: 35000, w: 2, d: 3, model: "mattress", kinds: ["bedroom", "studio", "living"] },
  { id: "double-bed", name: "Double bed", emoji: "🛌", category: "Sleep", price: 120000, w: 3, d: 4, model: "bed", kinds: ["bedroom", "studio", "living"] },
  { id: "wardrobe", name: "Wardrobe", emoji: "🚪", category: "Sleep", price: 85000, w: 3, d: 1, model: "wardrobe", kinds: ["bedroom", "studio", "living"] },

  // ── LIVING ──
  { id: "sofa", name: "3-seater sofa", emoji: "🛋️", category: "Living", price: 150000, w: 4, d: 2, model: "sofa", kinds: ["living", "studio"] },
  { id: "chair", name: "Office chair", emoji: "💺", category: "Living", price: 50000, w: 1, d: 1, model: "chair", kinds: ["living", "studio"] },
  { id: "centre-table", name: "Centre table", emoji: "🪵", category: "Living", price: 30000, w: 2, d: 1, model: "table", kinds: ["living", "studio"] },
  { id: "tv-stand", name: "TV and stand", emoji: "📺", category: "Living", price: 180000, w: 3, d: 1, model: "tv", kinds: ["living", "studio", "bedroom"] },
  { id: "dining-set", name: "Dining set", emoji: "🍽️", category: "Living", price: 110000, w: 3, d: 3, model: "dining", kinds: ["living", "kitchen", "studio"] },

  // ── KITCHEN ──
  { id: "gas-cooker", name: "Gas cooker", emoji: "🔥", category: "Kitchen", price: 60000, w: 1, d: 1, model: "cooker", kinds: ["kitchen", "studio", "utility"] },
  { id: "refrigerator", name: "Refrigerator", emoji: "🧊", category: "Kitchen", price: 180000, w: 1, d: 1, model: "fridge", kinds: ["kitchen", "studio", "living"] },
  { id: "water-dispenser", name: "Water dispenser", emoji: "🚰", category: "Kitchen", price: 70000, w: 1, d: 1, model: "dispenser", kinds: ["kitchen", "living", "studio"] },

  // ── UTILITY ──
  { id: "utility-washing-machine", name: "Washing machine", emoji: "🧺", category: "Utility", price: 200000, w: 1, d: 1, model: "washer", kinds: ["utility", "kitchen", "studio", "bathroom"] },
  { id: "generator", name: "Small generator", emoji: "⚡", category: "Utility", price: 65000, w: 1, d: 1, model: "generator", kinds: ["utility", "balcony", "studio", "kitchen"] },
  { id: "standing-fan", name: "Standing fan", emoji: "🌀", category: "Utility", price: 25000, w: 1, d: 1, model: "fan", kinds: ["bedroom", "studio", "living", "kitchen"] },

  // ── BATHROOM ──
  { id: "bath-bucket-bowl", name: "Bucket & Bowl", emoji: "🪣", category: "Bathroom", price: 400, w: 1, d: 1, model: "bucket", kinds: ["bathroom"], image: "/images/bucket.jpg" },
  { id: "bath-water-drum", name: "Water Drum & Jerrycans", emoji: "🛢️", category: "Bathroom", price: 800, w: 1, d: 1, model: "water-drum", kinds: ["bathroom"], image: "/images/water-drum.jpg" },
  { id: "bath-wc-toilet", name: "WC Toilet", emoji: "🚽", category: "Bathroom", price: 3000, w: 1, d: 1, model: "toilet", kinds: ["bathroom"], image: "/images/toilet.jpg" },
  { id: "bath-rain-shower", name: "Rain Shower", emoji: "🚿", category: "Bathroom", price: 11400, w: 1, d: 1, model: "rain-shower", kinds: ["bathroom"], image: "/images/shower.jpg" },
  { id: "bath-baby-bath", name: "Baby Bath", emoji: "🛁", category: "Bathroom", price: 12000, w: 1, d: 1, model: "baby-bath", kinds: ["bathroom"], image: "/images/baby-bath.jpg" },
  { id: "bath-bathtub", name: "Bathtub", emoji: "🛀", category: "Bathroom", price: 19200, w: 2, d: 1, model: "bathtub", kinds: ["bathroom"], image: "/images/bathtub.jpg" },
  { id: "bath-washing-machine", name: "Washing Machine", emoji: "🌀", category: "Bathroom", price: 480000, w: 1, d: 1, model: "washer", kinds: ["bathroom"], image: "/images/washing-machine.jpg" },
  { id: "bath-jacuzzi", name: "Jacuzzi", emoji: "💦", category: "Bathroom", price: 25000000, w: 2, d: 2, model: "jacuzzi", kinds: ["bathroom"], image: "/images/jacuzzi.jpg" },

  // ── DECOR ──
  { id: "rug", name: "Floor rug", emoji: "🟫", category: "Decor", price: 20000, w: 3, d: 2, model: "rug", kinds: ["living", "bedroom", "studio"], flat: true },
  { id: "house-plant", name: "House plant", emoji: "🪴", category: "Decor", price: 8000, w: 1, d: 1, model: "plant", kinds: ["balcony", "living", "studio", "bedroom"] },
];

export const FURNITURE_CATEGORIES: FurnitureCategory[] = ["Sleep", "Living", "Kitchen", "Utility", "Bathroom", "Decor"];
export const FURNITURE_BY_ID: Record<string, FurnitureItem> = Object.fromEntries(FURNITURE_CATALOG.map((item) => [item.id, item]));

export function isRotated(rotation: Rotation): boolean {
  return rotation === 1 || rotation === 3;
}

export function footprint(item: FurnitureItem, rotation: Rotation): { w: number; d: number } {
  return isRotated(rotation) ? { w: item.d, d: item.w } : { w: item.w, d: item.d };
}

export function roomTiles(room: ApartmentRoom): { cols: number; rows: number } {
  const tile = room.tileSize ?? DEFAULT_TILE_SIZE;
  return {
    cols: Math.max(1, room.gridCols ?? Math.floor(room.width / tile + 1e-6)),
    rows: Math.max(1, room.gridRows ?? Math.floor(room.depth / tile + 1e-6)),
  };
}

export function furnitureGridFootprint(room: ApartmentRoom, item: FurnitureItem, rotation: Rotation): { w: number; d: number } {
  const { cols, rows } = roomTiles(room);
  const tile = room.tileSize ?? DEFAULT_TILE_SIZE;
  const cellWidth = room.width / cols;
  const cellDepth = room.depth / rows;
  const size = footprint(item, rotation);
  const physicalWidth = size.w * tile;
  const physicalDepth = size.d * tile;
  return {
    w: Math.max(1, Math.ceil(physicalWidth / cellWidth - 1e-8)),
    d: Math.max(1, Math.ceil(physicalDepth / cellDepth - 1e-8)),
  };
}

function rectanglesOverlap(a: { col: number; row: number; w: number; d: number }, b: { col: number; row: number; w: number; d: number }): boolean {
  return a.col < b.col + b.w && a.col + a.w > b.col && a.row < b.row + b.d && a.row + a.d > b.row;
}

// ✅ Helper: does any wall intersect this rectangle (in world coordinates)?
function rectIntersectsWall(
  rect: { x1: number; z1: number; x2: number; z2: number },
  wall: ApartmentWall,
  padding: number,
): boolean {
  if (wall.style === "railing") return false;
  const pad = wall.thickness / 2 + padding;
  const x1 = rect.x1 - pad;
  const z1 = rect.z1 - pad;
  const x2 = rect.x2 + pad;
  const z2 = rect.z2 + pad;

  const wdx = wall.end[0] - wall.start[0];
  const wdz = wall.end[1] - wall.start[1];
  const wlen = Math.hypot(wdx, wdz);
  if (wlen < 0.001) return false;

  // Simple AABB vs thin segment approximation: check a few sample points along the wall
  const steps = Math.max(2, Math.ceil(wlen / 0.25));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const wx = wall.start[0] + wdx * t;
    const wz = wall.start[1] + wdz * t;
    if (wx >= x1 && wx <= x2 && wz >= z1 && wz <= z2) return true;
  }
  return false;
}

// ✅ Does this wall have a passable opening at this position?
function wallOpeningAt(wall: ApartmentWall, layout: ApartmentLayout, worldX: number, worldZ: number): boolean {
  const openings = layout.openings.filter((o) => o.wallId === wall.id);
  const passable = openings.filter((o) => o.type === "door" || o.type === "arch" || o.type === "open");
  if (passable.length === 0) return false;

  const wdx = wall.end[0] - wall.start[0];
  const wdz = wall.end[1] - wall.start[1];
  const wlen = Math.hypot(wdx, wdz);
  if (wlen < 0.001) return false;

  // Project world point onto wall to get 'along' distance
  const t = ((worldX - wall.start[0]) * wdx + (worldZ - wall.start[1]) * wdz) / (wlen * wlen);
  if (t < 0 || t > 1) return false;
  const along = t * wlen;

  return passable.some((op) => Math.abs(along - op.position) < op.width / 2);
}

export function validateFurniturePlacement(
  layout: ApartmentLayout,
  placed: PlacedFurniture[],
  item: FurnitureItem,
  position: FurniturePosition,
  ignoreUid?: string,
): PlacementResult {
  const room = layout.rooms.find((entry) => entry.id === position.roomId);
  if (!room) return { ok: false, reason: "That room does not exist." };
  if (!item.kinds.includes(room.kind)) return { ok: false, reason: `${item.name} cannot be placed in this room.` };
  if (!Number.isInteger(position.col) || !Number.isInteger(position.row) || position.col < 0 || position.row < 0) {
    return { ok: false, reason: "Furniture must be placed on the tile grid." };
  }

  const { cols, rows } = roomTiles(room);
  const size = furnitureGridFootprint(room, item, position.rotation);
  if (position.col + size.w > cols || position.row + size.d > rows) {
    return { ok: false, reason: "Furniture must remain inside the room." };
  }

  const tile = room.tileSize ?? DEFAULT_TILE_SIZE;
  const cellWidth = room.width / cols;
  const cellDepth = room.depth / rows;

  // Compute world-space rectangle of the furniture footprint
  const physicalW = size.w * (item.w === item.d ? tile : tile); // using tile size
  const physicalD = size.d * (item.w === item.d ? tile : tile);
  const worldX1 = room.x + position.col * cellWidth;
  const worldZ1 = room.z + position.row * cellDepth;
  const worldX2 = worldX1 + physicalW;
  const worldZ2 = worldZ1 + physicalD;

  // ✅ Reject if the furniture overlaps any wall (unless there's a doorway opening there)
  for (const wall of layout.walls) {
    if (wall.style === "railing") continue;
    if (!rectIntersectsWall({ x1: worldX1, z1: worldZ1, x2: worldX2, z2: worldZ2 }, wall, 0.05)) continue;

    // If the wall passes through the furniture rect, check if it's a doorway
    // Sample the wall to see if every intersecting point is inside an opening
    const wdx = wall.end[0] - wall.start[0];
    const wdz = wall.end[1] - wall.start[1];
    const wlen = Math.hypot(wdx, wdz);
    if (wlen < 0.001) continue;

    const steps = Math.max(2, Math.ceil(wlen / 0.25));
    let anyBlocked = false;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const wx = wall.start[0] + wdx * t;
      const wz = wall.start[1] + wdz * t;
      const pad = wall.thickness / 2 + 0.05;
      const inside = wx >= worldX1 - pad && wx <= worldX2 + pad && wz >= worldZ1 - pad && wz <= worldZ2 + pad;
      if (!inside) continue;
      if (!wallOpeningAt(wall, layout, wx, wz)) {
        anyBlocked = true;
        break;
      }
    }
    if (anyBlocked) {
      return { ok: false, reason: "Furniture cannot overlap walls." };
    }
  }

  // Existing furniture overlap check
  const candidate = { col: position.col, row: position.row, ...size };
  for (const existing of placed) {
    if (existing.uid === ignoreUid || existing.roomId !== position.roomId) continue;
    const existingItem = FURNITURE_BY_ID[existing.itemId];
    if (!existingItem) continue;
    if (item.flat || existingItem.flat) continue;
    const existingSize = furnitureGridFootprint(room, existingItem, existing.rotation);
    const existingRect = { col: existing.col, row: existing.row, ...existingSize };
    if (rectanglesOverlap(candidate, existingRect)) {
      return { ok: false, reason: "Furniture cannot overlap other furniture." };
    }
  }

  return { ok: true };
}

export function findSpot(layout: ApartmentLayout, placed: PlacedFurniture[], item: FurnitureItem): Omit<PlacedFurniture, "uid" | "itemId"> | null {
  const rotations: Rotation[] = item.w === item.d ? [0] : [0, 1, 2, 3];
  for (const kind of item.kinds) {
    const rooms = layout.rooms.filter((room) => room.kind === kind);
    for (const room of rooms) {
      const { cols, rows } = roomTiles(room);
      for (const rotation of rotations) {
        const size = furnitureGridFootprint(room, item, rotation);
        for (let row = 0; row + size.d <= rows; row++) {
          for (let col = 0; col + size.w <= cols; col++) {
            const position = { roomId: room.id, col, row, rotation };
            const result = validateFurniturePlacement(layout, placed, item, position);
            if (result.ok) return position;
          }
        }
      }
    }
  }
  return null;
}