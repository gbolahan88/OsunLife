import {
  DEFAULT_TILE_SIZE,
  type ApartmentLayout,
  type ApartmentRoom,
  type RoomKind,
} from "@/lib/apartmentConfig";

export type FurnitureCategory = "Sleep" | "Living" | "Kitchen" | "Utility" | "Decor";

export type FurnitureModelId =
  | "mattress"
  | "bed"
  | "wardrobe"
  | "fan"
  | "sofa"
  | "table"
  | "tv"
  | "dining"
  | "fridge"
  | "cooker"
  | "washer"
  | "generator"
  | "rug"
  | "dispenser"
  | "plant";

export type FurnitureItem = {
  id: string;
  name: string;
  emoji: string;
  category: FurnitureCategory;
  price: number;
  // Footprint in floor tiles (width along x, depth along z) before rotation.
  w: number;
  d: number;
  model: FurnitureModelId;
  // Rooms where it can go, in order of preference.
  kinds: RoomKind[];
  // Flat items (rugs) lie on the floor and don't block other furniture.
  flat?: boolean;
};

export type PlacedFurniture = {
  uid: string;
  itemId: string;
  roomId: string;
  col: number; // tile column inside the room
  row: number; // tile row inside the room
  rotated: boolean;
};

export const FURNITURE_CATALOG: FurnitureItem[] = [
  { id: "foam-mattress", name: "Foam mattress", emoji: "🛏️", category: "Sleep", price: 35_000, w: 2, d: 3, model: "mattress", kinds: ["bedroom", "studio", "living"] },
  { id: "double-bed", name: "Double bed", emoji: "🛌", category: "Sleep", price: 120_000, w: 3, d: 4, model: "bed", kinds: ["bedroom", "studio", "living"] },
  { id: "wardrobe", name: "Wardrobe", emoji: "🚪", category: "Sleep", price: 85_000, w: 3, d: 1, model: "wardrobe", kinds: ["bedroom", "studio", "living"] },
  { id: "standing-fan", name: "Standing fan", emoji: "🌀", category: "Utility", price: 25_000, w: 1, d: 1, model: "fan", kinds: ["bedroom", "studio", "living", "kitchen"] },

  { id: "sofa", name: "3-seater sofa", emoji: "🛋️", category: "Living", price: 150_000, w: 4, d: 2, model: "sofa", kinds: ["living", "studio"] },
  { id: "centre-table", name: "Centre table", emoji: "🪵", category: "Living", price: 30_000, w: 2, d: 1, model: "table", kinds: ["living", "studio"] },
  { id: "tv-stand", name: "TV and stand", emoji: "📺", category: "Living", price: 180_000, w: 3, d: 1, model: "tv", kinds: ["living", "studio", "bedroom"] },
  { id: "dining-set", name: "Dining set", emoji: "🍽️", category: "Living", price: 110_000, w: 3, d: 3, model: "dining", kinds: ["living", "kitchen", "studio"] },

  { id: "gas-cooker", name: "Gas cooker", emoji: "🔥", category: "Kitchen", price: 60_000, w: 1, d: 1, model: "cooker", kinds: ["kitchen", "studio", "utility"] },
  { id: "refrigerator", name: "Refrigerator", emoji: "🧊", category: "Kitchen", price: 180_000, w: 1, d: 1, model: "fridge", kinds: ["kitchen", "studio", "living"] },
  { id: "water-dispenser", name: "Water dispenser", emoji: "🚰", category: "Kitchen", price: 70_000, w: 1, d: 1, model: "dispenser", kinds: ["kitchen", "living", "studio"] },

  { id: "washing-machine", name: "Washing machine", emoji: "🧺", category: "Utility", price: 200_000, w: 1, d: 1, model: "washer", kinds: ["utility", "kitchen", "studio", "bathroom"] },
  { id: "generator", name: "Small generator", emoji: "⚡", category: "Utility", price: 65_000, w: 1, d: 1, model: "generator", kinds: ["utility", "balcony", "studio", "kitchen"] },

  { id: "rug", name: "Floor rug", emoji: "🟫", category: "Decor", price: 20_000, w: 3, d: 2, model: "rug", kinds: ["living", "bedroom", "studio"], flat: true },
  { id: "house-plant", name: "House plant", emoji: "🪴", category: "Decor", price: 8_000, w: 1, d: 1, model: "plant", kinds: ["balcony", "living", "studio", "bedroom"] },
];

export const FURNITURE_CATEGORIES: FurnitureCategory[] = ["Sleep", "Living", "Kitchen", "Utility", "Decor"];

export const FURNITURE_BY_ID: Record<string, FurnitureItem> = Object.fromEntries(
  FURNITURE_CATALOG.map((item) => [item.id, item])
);

export function footprint(item: FurnitureItem, rotated: boolean) {
  return rotated ? { w: item.d, d: item.w } : { w: item.w, d: item.d };
}

export function roomTiles(room: ApartmentRoom) {
  const tile = room.tileSize ?? DEFAULT_TILE_SIZE;
  return {
    cols: Math.floor(room.width / tile + 1e-6),
    rows: Math.floor(room.depth / tile + 1e-6),
  };
}

function overlaps(
  a: { col: number; row: number; w: number; d: number },
  b: { col: number; row: number; w: number; d: number }
) {
  return a.col < b.col + b.w && a.col + a.w > b.col && a.row < b.row + b.d && a.row + a.d > b.row;
}

// Finds the first free spot for an item, filling from the back-left corner of
// the best-suited room. Returns null when nothing fits.
export function findSpot(
  layout: ApartmentLayout,
  placed: PlacedFurniture[],
  item: FurnitureItem
): Omit<PlacedFurniture, "uid" | "itemId"> | null {
  const rotations = item.w === item.d ? [false] : [false, true];

  for (const kind of item.kinds) {
    for (const room of layout.rooms.filter((entry) => entry.kind === kind)) {
      const { cols, rows } = roomTiles(room);

      const neighbours = placed
        .filter((entry) => entry.roomId === room.id)
        .map((entry) => ({ entry, def: FURNITURE_BY_ID[entry.itemId] }))
        .filter(({ def }) => def && Boolean(def.flat) === Boolean(item.flat))
        .map(({ entry, def }) => ({ col: entry.col, row: entry.row, ...footprint(def, entry.rotated) }));

      for (const rotated of rotations) {
        const size = footprint(item, rotated);
        for (let row = 0; row + size.d <= rows; row += 1) {
          for (let col = 0; col + size.w <= cols; col += 1) {
            const candidate = { col, row, ...size };
            if (!neighbours.some((other) => overlaps(candidate, other))) {
              return { roomId: room.id, col, row, rotated };
            }
          }
        }
      }
    }
  }

  return null;
}