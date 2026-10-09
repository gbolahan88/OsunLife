export type NeedKey =
  | "food"
  | "energy"
  | "fun"
  | "social"
  | "hygiene"
  | "bladder";

export type Needs = Record<NeedKey, number>;

export const NEED_KEYS: NeedKey[] = [
  "food",
  "energy",
  "fun",
  "social",
  "hygiene",
  "bladder",
];

// drainPerHour = how many points (out of 100) a need loses per game hour.
export const NEED_META: Record<
  NeedKey,
  { label: string; emoji: string; drainPerHour: number }
> = {
  food: { label: "Food", emoji: "🍲", drainPerHour: 4 },
  energy: { label: "Energy", emoji: "⚡", drainPerHour: 3 },
  fun: { label: "Fun", emoji: "🎉", drainPerHour: 2.5 },
  social: { label: "Social", emoji: "💬", drainPerHour: 2 },
  hygiene: { label: "Hygiene", emoji: "🫧", drainPerHour: 2 },
  bladder: { label: "Bladder", emoji: "🚽", drainPerHour: 5 },
};

// Staying awake at night wears you out faster.
export const NIGHT_ENERGY_MULTIPLIER = 1.6;

export const INITIAL_NEEDS: Needs = {
  food: 80,
  energy: 80,
  fun: 80,
  social: 80,
  hygiene: 80,
  bladder: 80,
};

export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

export function averageNeeds(needs: Needs): number {
  const total = NEED_KEYS.reduce((sum, key) => sum + needs[key], 0);
  return total / NEED_KEYS.length;
}

export function getMood(needs: Needs): { label: string; emoji: string } {
  const avg = averageNeeds(needs);
  if (avg >= 80) return { label: "Very Happy", emoji: "😄" };
  if (avg >= 60) return { label: "Happy", emoji: "🙂" };
  if (avg >= 40) return { label: "Okay", emoji: "😐" };
  if (avg >= 20) return { label: "Sad", emoji: "😟" };
  return { label: "Miserable", emoji: "😩" };
}