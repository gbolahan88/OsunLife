export const BILLBOARD_PRICES = {
  image: 1000,
  video: 2000,
} as const;

export const BILLBOARD_AD_DAYS = 7;
export const BILLBOARD_MAX_FILE_SIZE = 30 * 1024 * 1024;
export const BILLBOARD_BUCKET = "billboard-ads";

export const BILLBOARD_IDS = [
  "billboard-1",
  "billboard-2",
  "billboard-3",
  "billboard-4",
  "billboard-5",
  "billboard-6",
] as const;

export type BillboardId = (typeof BILLBOARD_IDS)[number];
export type BillboardAdType = keyof typeof BILLBOARD_PRICES;

export type BillboardAd = {
  id: string;
  boardId: BillboardId;
  adType: BillboardAdType;
  mediaUrl: string;
};

export function isBillboardId(value: string): value is BillboardId {
  return BILLBOARD_IDS.some((id) => id === value);
}
