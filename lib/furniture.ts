import {
  DEFAULT_TILE_SIZE,
  type ApartmentLayout,
  type ApartmentRoom,
  type RoomKind,
} from "@/lib/apartmentConfig";

export type FurnitureCategory =
  | "Sleep"
  | "Living"
  | "Kitchen"
  | "Utility"
  | "Decor";

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
  w: number;
  d: number;
  model: FurnitureModelId;
  kinds: RoomKind[];
  flat?: boolean;
};

export type PlacedFurniture = {
  uid: string;
  itemId: string;
  roomId: string;
  col: number;
  row: number;
  rotated: boolean;
};

export type FurniturePosition = {
  roomId: string;
  col: number;
  row: number;
  rotated: boolean;
};

export type PlacementResult = {
  ok: boolean;
  reason?: string;
};

export const FURNITURE_CATALOG: FurnitureItem[] = [
  {
    id: "foam-mattress",
    name: "Foam mattress",
    emoji: "🛏️",
    category: "Sleep",
    price: 35000,
    w: 2,
    d: 3,
    model: "mattress",
    kinds: ["bedroom", "studio", "living"],
  },
  {
    id: "double-bed",
    name: "Double bed",
    emoji: "🛌",
    category: "Sleep",
    price: 120000,
    w: 3,
    d: 4,
    model: "bed",
    kinds: ["bedroom", "studio", "living"],
  },
  {
    id: "wardrobe",
    name: "Wardrobe",
    emoji: "🚪",
    category: "Sleep",
    price: 85000,
    w: 3,
    d: 1,
    model: "wardrobe",
    kinds: ["bedroom", "studio", "living"],
  },
  {
    id: "standing-fan",
    name: "Standing fan",
    emoji: "🌀",
    category: "Utility",
    price: 25000,
    w: 1,
    d: 1,
    model: "fan",
    kinds: ["bedroom", "studio", "living", "kitchen"],
  },
  {
    id: "sofa",
    name: "3-seater sofa",
    emoji: "🛋️",
    category: "Living",
    price: 150000,
    w: 4,
    d: 2,
    model: "sofa",
    kinds: ["living", "studio"],
  },
  {
    id: "centre-table",
    name: "Centre table",
    emoji: "🪵",
    category: "Living",
    price: 30000,
    w: 2,
    d: 1,
    model: "table",
    kinds: ["living", "studio"],
  },
  {
    id: "tv-stand",
    name: "TV and stand",
    emoji: "📺",
    category: "Living",
    price: 180000,
    w: 3,
    d: 1,
    model: "tv",
    kinds: ["living", "studio", "bedroom"],
  },
  {
    id: "dining-set",
    name: "Dining set",
    emoji: "🍽️",
    category: "Living",
    price: 110000,
    w: 3,
    d: 3,
    model: "dining",
    kinds: ["living", "kitchen", "studio"],
  },
  {
    id: "gas-cooker",
    name: "Gas cooker",
    emoji: "🔥",
    category: "Kitchen",
    price: 60000,
    w: 1,
    d: 1,
    model: "cooker",
    kinds: ["kitchen", "studio", "utility"],
  },
  {
    id: "refrigerator",
    name: "Refrigerator",
    emoji: "🧊",
    category: "Kitchen",
    price: 180000,
    w: 1,
    d: 1,
    model: "fridge",
    kinds: ["kitchen", "studio", "living"],
  },
  {
    id: "water-dispenser",
    name: "Water dispenser",
    emoji: "🚰",
    category: "Kitchen",
    price: 70000,
    w: 1,
    d: 1,
    model: "dispenser",
    kinds: ["kitchen", "living", "studio"],
  },
  {
    id: "washing-machine",
    name: "Washing machine",
    emoji: "🧺",
    category: "Utility",
    price: 200000,
    w: 1,
    d: 1,
    model: "washer",
    kinds: ["utility", "kitchen", "studio", "bathroom"],
  },
  {
    id: "generator",
    name: "Small generator",
    emoji: "⚡",
    category: "Utility",
    price: 65000,
    w: 1,
    d: 1,
    model: "generator",
    kinds: ["utility", "balcony", "studio", "kitchen"],
  },
  {
    id: "rug",
    name: "Floor rug",
    emoji: "🟫",
    category: "Decor",
    price: 20000,
    w: 3,
    d: 2,
    model: "rug",
    kinds: ["living", "bedroom", "studio"],
    flat: true,
  },
  {
    id: "house-plant",
    name: "House plant",
    emoji: "🪴",
    category: "Decor",
    price: 8000,
    w: 1,
    d: 1,
    model: "plant",
    kinds: ["balcony", "living", "studio", "bedroom"],
  },
];

export const FURNITURE_CATEGORIES: FurnitureCategory[] = [
  "Sleep",
  "Living",
  "Kitchen",
  "Utility",
  "Decor",
];

export const FURNITURE_BY_ID: Record<string, FurnitureItem> =
  Object.fromEntries(
    FURNITURE_CATALOG.map((item) => [item.id, item]),
  );

export function footprint(
  item: FurnitureItem,
  rotated: boolean,
): { w: number; d: number } {
  return rotated
    ? { w: item.d, d: item.w }
    : { w: item.w, d: item.d };
}

/**
 * Number of placement cells available in a room.
 * Grid dimensions can be denser than the physical furniture tile size.
 */
export function roomTiles(
  room: ApartmentRoom,
): { cols: number; rows: number } {
  const tile = room.tileSize ?? DEFAULT_TILE_SIZE;

  return {
    cols: Math.max(
      1,
      room.gridCols ?? Math.floor(room.width / tile + 1e-6),
    ),
    rows: Math.max(
      1,
      room.gridRows ?? Math.floor(room.depth / tile + 1e-6),
    ),
  };
}

/**
 * Convert the furniture's physical footprint into placement-grid cells.
 * Furniture models retain their original physical dimensions.
 */
export function furnitureGridFootprint(
  room: ApartmentRoom,
  item: FurnitureItem,
  rotated: boolean,
): { w: number; d: number } {
  const { cols, rows } = roomTiles(room);
  const tile = room.tileSize ?? DEFAULT_TILE_SIZE;
  const cellWidth = room.width / cols;
  const cellDepth = room.depth / rows;
  const size = footprint(item, rotated);

  const physicalWidth = size.w * tile;
  const physicalDepth = size.d * tile;

  return {
    w: Math.max(1, Math.ceil(physicalWidth / cellWidth - 1e-8)),
    d: Math.max(1, Math.ceil(physicalDepth / cellDepth - 1e-8)),
  };
}

function rectanglesOverlap(
  a: { col: number; row: number; w: number; d: number },
  b: { col: number; row: number; w: number; d: number },
): boolean {
  return (
    a.col < b.col + b.w &&
    a.col + a.w > b.col &&
    a.row < b.row + b.d &&
    a.row + a.d > b.row
  );
}

export function validateFurniturePlacement(
  layout: ApartmentLayout,
  placed: PlacedFurniture[],
  item: FurnitureItem,
  position: FurniturePosition,
  ignoreUid?: string,
): PlacementResult {
  const room = layout.rooms.find(
    (entry) => entry.id === position.roomId,
  );

  if (!room) {
    return { ok: false, reason: "That room does not exist." };
  }

  if (!item.kinds.includes(room.kind)) {
    return {
      ok: false,
      reason: `${item.name} cannot be placed in this room.`,
    };
  }

  if (
    !Number.isInteger(position.col) ||
    !Number.isInteger(position.row) ||
    position.col < 0 ||
    position.row < 0
  ) {
    return {
      ok: false,
      reason: "Furniture must be placed on the tile grid.",
    };
  }

  const { cols, rows } = roomTiles(room);
  const size = furnitureGridFootprint(
    room,
    item,
    position.rotated,
  );

  if (
    position.col + size.w > cols ||
    position.row + size.d > rows
  ) {
    return {
      ok: false,
      reason: "Furniture must remain inside the room.",
    };
  }

  const candidate = {
    col: position.col,
    row: position.row,
    ...size,
  };

  for (const existing of placed) {
    if (
      existing.uid === ignoreUid ||
      existing.roomId !== position.roomId
    ) {
      continue;
    }

    const existingItem = FURNITURE_BY_ID[existing.itemId];
    if (!existingItem) continue;

    // Flat decorations such as rugs can sit underneath solid furniture.
    if (item.flat || existingItem.flat) continue;

    const existingSize = furnitureGridFootprint(
      room,
      existingItem,
      existing.rotated,
    );

    const existingRect = {
      col: existing.col,
      row: existing.row,
      ...existingSize,
    };

    if (rectanglesOverlap(candidate, existingRect)) {
      return {
        ok: false,
        reason: "Furniture cannot overlap other furniture.",
      };
    }
  }

  return { ok: true };
}

export function findSpot(
  layout: ApartmentLayout,
  placed: PlacedFurniture[],
  item: FurnitureItem,
): Omit<PlacedFurniture, "uid" | "itemId"> | null {
  const rotations = item.w === item.d
    ? [false]
    : [false, true];

  for (const kind of item.kinds) {
    const rooms = layout.rooms.filter(
      (room) => room.kind === kind,
    );

    for (const room of rooms) {
      const { cols, rows } = roomTiles(room);

      for (const rotated of rotations) {
        const size = furnitureGridFootprint(
          room,
          item,
          rotated,
        );

        for (
          let row = 0;
          row + size.d <= rows;
          row++
        ) {
          for (
            let col = 0;
            col + size.w <= cols;
            col++
          ) {
            const position = {
              roomId: room.id,
              col,
              row,
              rotated,
            };

            const result = validateFurniturePlacement(
              layout,
              placed,
              item,
              position,
            );

            if (result.ok) {
              return position;
            }
          }
        }
      }
    }
  }

  return null;
}
