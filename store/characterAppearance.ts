export type Gender = "Man" | "Woman";
export type Hairstyle = "short" | "afro" | "braids" | "bald" | "curls" | "locs" | "classic";
export type OutfitType = "Casual" | "Hoodie" | "Office" | "Chill" | "Site work";
export type FabricType = "Plain" | "Ankara" | "Adire" | "Aso-oke";

export type CharacterAppearance = {
  gender: Gender;
  skin: string;
  hair: string;
  hairstyle: Hairstyle;
  outfit: OutfitType;
  fabric: FabricType;
  shirt: string;
  trousers: string;
};

export const DEFAULT_CHARACTER_APPEARANCE: CharacterAppearance = {
  gender: "Man",
  skin: "#8d5524",
  hair: "#2c1b18",
  hairstyle: "short",
  outfit: "Office",
  fabric: "Ankara",
  shirt: "#2876b9",
  trousers: "#252f45",
};

export const SKIN_TONES = [
  { label: "Deep brown", value: "#4b2e22" },
  { label: "Dark brown", value: "#70472f" },
  { label: "Warm brown", value: "#8d5524" },
  { label: "Medium brown", value: "#a86f4b" },
  { label: "Light brown", value: "#c58b63" },
];

export const HAIR_COLORS = [
  { label: "Black", value: "#2c1b18" },
  { label: "Dark brown", value: "#493126" },
  { label: "Brown", value: "#75482d" },
  { label: "Blonde", value: "#c69b45" },
  { label: "Purple", value: "#6d28d9" },
];

export const SHIRT_COLORS = [
  { label: "Blue", value: "#2876b9" },
  { label: "White", value: "#f5f5f0" },
  { label: "Black", value: "#252525" },
  { label: "Green", value: "#198754" },
  { label: "Yellow", value: "#eab308" },
  { label: "Red", value: "#dc2626" },
  { label: "Purple", value: "#7c3aed" },
];

export const TROUSER_COLORS = [
  { label: "Navy", value: "#252f45" },
  { label: "Black", value: "#222222" },
  { label: "Blue jeans", value: "#315a8c" },
  { label: "Grey", value: "#737373" },
  { label: "Cream", value: "#d8c9a7" },
  { label: "Green", value: "#3f5c3b" },
];

export const GENDERS: Gender[] = ["Man", "Woman"];
export const HAIRSTYLES: Hairstyle[] = ["short", "afro", "braids", "bald", "curls", "locs", "classic"];
export const OUTFITS: OutfitType[] = ["Casual", "Hoodie", "Office", "Chill", "Site work"];
export const FABRICS: FabricType[] = ["Plain", "Ankara", "Adire", "Aso-oke"];

/* ------------------------------------------------------------------ */
/*  DiceBear avatar URL builder (avataaars = full-body cartoon)        */
/* ------------------------------------------------------------------ */

const DICEBEAR_STYLE = "avataaars";

// Our hairstyles → DiceBear avataaars "top" options
const HAIR_MAP: Record<Hairstyle, string> = {
  short: "shortFlat",
  afro: "bigHair",
  braids: "longHairBraids",
  bald: "noHair",
  curls: "curly",
  locs: "dreads01",
  classic: "shortRound",
};

// Our outfits → DiceBear avataaars "clothing" options
const OUTFIT_MAP: Record<OutfitType, string> = {
  Casual: "graphicShirt",
  Hoodie: "hoodie",
  Office: "blazerAndShirt",
  Chill: "shirtCrewNeck",
  "Site work": "overall",
};

function hex(color: string) {
  return color.replace("#", "");
}

export function buildAvatarUrl(appearance: CharacterAppearance, size = 240): string {
  // Encode every customization choice into the seed so DiceBear always
  // returns a distinct, stable character for each combination.
  const seed = [
    appearance.gender,
    appearance.hairstyle,
    appearance.outfit,
    appearance.fabric,
    appearance.skin,
    appearance.hair,
    appearance.shirt,
    appearance.trousers,
  ].join("-");

  // Build params with URLSearchParams, ONLY setting keys with valid values.
  // DiceBear v9 returns HTTP 400 if any param is empty string.
  const params = new URLSearchParams();

  params.set("seed", seed);
  params.set("size", String(size));
  params.set("backgroundColor", "transparent");

  // Skin
  params.set("skinColor", hex(appearance.skin));

  // Hair
  params.set("hairColor", hex(appearance.hair));
  params.set("top", HAIR_MAP[appearance.hairstyle]);

  // Facial hair only for men — omit entirely for women
  if (appearance.gender === "Man") {
    params.set("facialHair", "beardMedium");
    params.set("facialHairColor", hex(appearance.hair));
  }

  // Outfit
  params.set("clothing", OUTFIT_MAP[appearance.outfit]);
  params.set("clothesColor", hex(appearance.shirt));

  // Face — use only simple, definitely-valid v9 values
  params.set("eyes", "default");
  params.set("mouth", "default");
  params.set("eyebrow", "default");

  // NOTE: deliberately NOT sending:
  //   - facialHair for women (400 error)
  //   - clothingGraphic (invalid value + combo issue)
  //   - accessories, hat, hatColor, style (not needed / v7-only)

  return `https://api.dicebear.com/9.x/${DICEBEAR_STYLE}/png?${params.toString()}`;
}

export function buildWalkingAvatarUrl(appearance: CharacterAppearance, size = 240): string {
  return buildAvatarUrl(appearance, size);
}

/**
 * Returns a URL for a headshot (bust portrait) of the character,
 * suitable for small circular buttons.
 */
export function buildAvatarHeadshotUrl(
  appearance: CharacterAppearance,
  size = 128
): string {
  const seed = `${appearance.gender}-${appearance.hairstyle}-${appearance.outfit}-${appearance.fabric}`;

  const params = new URLSearchParams({
    seed,
    size: String(size),
    backgroundColor: "transparent",
    skinColor: hex(appearance.skin),
    hairColor: hex(appearance.hair),
    top: HAIR_MAP[appearance.hairstyle],
    clothing: OUTFIT_MAP[appearance.outfit],
    clothesColor: hex(appearance.shirt),
  });

  return `https://api.dicebear.com/9.x/${DICEBEAR_STYLE}/png?${params.toString()}`;
}