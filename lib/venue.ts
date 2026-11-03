// lib/venue.ts

export type VenueActionKind =
  | "spray" | "hype" | "dj" | "drink" | "bottle" | "gold" | "round" | "takeover";
export type VenueGroup = "Money" | "Hype" | "Drinks" | "Flex";

export type VenueAction = {
  id: string;
  emoji: string;
  label: string;
  /** Naira taken from the buyer's cash */
  price: number;
  kind: VenueActionKind;
  group: VenueGroup;
  /** Shown in the feed. {name} and {venue} are filled in. */
  announce: string;
  /** Big banner shown to everyone in the room */
  banner?: "hype" | "dj" | "owns";
  /** Falling emoji shown to everyone in the room */
  fx: { emoji: string[]; count: number };
  venues: string[];
};

export const VENUE_GROUPS: VenueGroup[] = ["Money", "Hype", "Drinks", "Flex"];

const CLUB = ["zeus-club"];
const LOUNGES = ["berrymist", "circle-lounge"];
const ALL = [...CLUB, ...LOUNGES];

/** Anything at or above this needs a second tap to confirm. */
export const CONFIRM_FROM = 1_000_000;

export const VENUE_ACTIONS: VenueAction[] = [
  // ── Money ──
  { id: "spray-5k", emoji: "💵", label: "Spray ₦5,000", price: 5_000, kind: "spray", group: "Money",
    announce: "{name} sprayed ₦5,000 on the dance floor 💵", fx: { emoji: [], count: 0 }, venues: CLUB },
  { id: "spray-100k", emoji: "💸", label: "Spray ₦100,000", price: 100_000, kind: "spray", group: "Money",
    announce: "{name} is spraying ₦100,000 💸", fx: { emoji: [], count: 0 }, venues: CLUB },
  { id: "spray-1m", emoji: "🤑", label: "Make it rain ₦1,000,000", price: 1_000_000, kind: "spray", group: "Money",
    announce: "{name} made it rain ₦1,000,000 🤑", fx: { emoji: [], count: 0 }, venues: CLUB },

  // ── Hype ──
  { id: "hype-man", emoji: "🎤", label: "Pay the Hype Man", price: 20_000, kind: "hype", group: "Hype",
    announce: "{name} paid the Hype Man 🎤", banner: "hype", fx: { emoji: ["🎉", "✨"], count: 14 }, venues: CLUB },
  { id: "dj-shoutout", emoji: "🎧", label: "Pay the DJ for a shout-out", price: 50_000, kind: "dj", group: "Hype",
    announce: "{name} paid the DJ for a shout-out 🎧", banner: "dj", fx: { emoji: ["🎶", "✨"], count: 14 }, venues: CLUB },

  // ── Drinks ──
  { id: "cocktail", emoji: "🍸", label: "Signature cocktail", price: 10_000, kind: "drink", group: "Drinks",
    announce: "{name} is sipping a signature cocktail 🍸", fx: { emoji: [], count: 0 }, venues: ALL },
  { id: "bottle-vip", emoji: "🍾", label: "Bottle service (VIP)", price: 250_000, kind: "bottle", group: "Drinks",
    announce: "{name} ordered bottle service 🍾", fx: { emoji: ["🍾"], count: 14 }, venues: ALL },
  { id: "gold-bottle", emoji: "🥂", label: "Gold bottle (Dorime!)", price: 1_000_000, kind: "gold", group: "Drinks",
    announce: "{name} popped the Gold Bottle. DORIME! 🥂", fx: { emoji: ["🥂", "🍾", "✨"], count: 28 }, venues: ALL },
  { id: "round", emoji: "🍻", label: "Buy the whole room a round", price: 2_000_000, kind: "round", group: "Drinks",
    announce: "{name} bought everybody a round 🍻 Cheers!", fx: { emoji: ["🍻", "🥂"], count: 30 }, venues: ALL },

  // ── Flex ──
  { id: "takeover", emoji: "👑", label: "Take over {venue} for the night", price: 8_000_000, kind: "takeover", group: "Flex",
    announce: "{name} took over {venue} for the night 👑", banner: "owns", fx: { emoji: ["👑", "✨", "💵"], count: 44 }, venues: ALL },
];

export type Reaction = { id: string; emoji: string; label: string };

export const REACTIONS: Reaction[] = [
  { id: "wave", emoji: "👋🏾", label: "Wave" },
  { id: "laugh", emoji: "😂", label: "Laugh" },
  { id: "dance", emoji: "💃", label: "Dance" },
  { id: "abeg", emoji: "🙏🏾", label: "Abeg" },
  { id: "hiss", emoji: "😤", label: "Hiss" },
];

export type VenueSpot = { id: string; emoji: string; label: string; x: number; z: number };

/** "Spots here": tap one to walk there. Positions are in room units. */
export const VENUE_SPOTS: Record<string, VenueSpot[]> = {
  "zeus-club": [
    { id: "floor", emoji: "🪩", label: "Dance floor", x: 0, z: 3.2 },
    { id: "vip", emoji: "🍾", label: "VIP booth", x: 5.6, z: 4.9 },
    { id: "bar", emoji: "🍸", label: "Bar", x: -5, z: 1.4 },
    { id: "dj", emoji: "🎧", label: "DJ booth", x: 0, z: -3.8 },
  ],
  berrymist: [
    { id: "bar", emoji: "🍸", label: "Bar", x: 0, z: -3.4 },
    { id: "lounge", emoji: "🪑", label: "Lounge seat", x: 0, z: 0.9 },
  ],
  "circle-lounge": [
    { id: "bar", emoji: "🍸", label: "Bar", x: 0, z: -3.4 },
    { id: "lounge", emoji: "🪑", label: "Lounge seat", x: 0, z: 0.9 },
  ],
};

export function isVenue(buildingId: string): boolean {
  return buildingId in VENUE_SPOTS;
}

export function actionsFor(buildingId: string): VenueAction[] {
  return VENUE_ACTIONS.filter((action) => action.venues.includes(buildingId));
}

export function findAction(actionId: string, buildingId: string): VenueAction | undefined {
  return VENUE_ACTIONS.find((action) => action.id === actionId && action.venues.includes(buildingId));
}