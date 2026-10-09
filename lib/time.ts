// The game runs on the real clock in Nigeria (WAT, UTC+1, no daylight saving).
// Everyone sees the same time, so day/night and weekly rent match for all players.
export const GAME_TIME_ZONE = "Africa/Lagos";

export type DayPhase = "dawn" | "day" | "dusk" | "night";

export const PHASE_LABEL: Record<DayPhase, string> = {
  dawn: "Dawn",
  day: "Daytime",
  dusk: "Dusk",
  night: "Night",
};

// Colour laid over the screen for each phase (rgba so we can animate it).
export const PHASE_TINT: Record<DayPhase, string> = {
  dawn: "rgba(255, 170, 100, 0.16)",
  day: "rgba(255, 255, 255, 0)",
  dusk: "rgba(255, 110, 60, 0.22)",
  night: "rgba(10, 20, 70, 0.12)",
};

export type GameClock = {
  hour: number; // 0-23
  minute: number; // 0-59
  weekday: string; // "Mon" ... "Sun"
  dateLabel: string; // e.g. "Thu 8 Oct"
};

const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: GAME_TIME_ZONE,
  hour: "numeric",
  minute: "numeric",
  weekday: "short",
  day: "numeric",
  month: "short",
  hourCycle: "h23",
});

// Turns a timestamp (milliseconds) into the clock reading in Nigeria.
export function getGameClock(timestamp: number): GameClock {
  const parts = formatter.formatToParts(new Date(timestamp));
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const weekday = get("weekday");
  return {
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    weekday,
    dateLabel: `${weekday} ${get("day")} ${get("month")}`,
  };
}

// dawn 5-7, day 7-17, dusk 17-19, night 19-5
export function getDayPhase(hour: number): DayPhase {
  if (hour >= 5 && hour < 7) return "dawn";
  if (hour >= 7 && hour < 17) return "day";
  if (hour >= 17 && hour < 19) return "dusk";
  return "night";
}

export function formatClock(clock: GameClock): string {
  const suffix = clock.hour >= 12 ? "PM" : "AM";
  const h12 = clock.hour % 12 === 0 ? 12 : clock.hour % 12;
  return `${h12}:${clock.minute.toString().padStart(2, "0")} ${suffix}`;
}

// Handy for later steps: rent is due every Saturday.
export function isSaturday(clock: GameClock): boolean {
  return clock.weekday === "Sat";
}