import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getDayPhase, getGameClock } from "@/lib/time";
import {
  clamp,
  INITIAL_NEEDS,
  NEED_KEYS,
  NEED_META,
  NIGHT_ENERGY_MULTIPLIER,
  type Needs,
} from "@/lib/needs";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

// If a player is away longer than this, we only apply this much drain.
const MAX_CATCH_UP_MINUTES = 8 * 60;

type GameState = {
  lastTick: number; // timestamp (ms) up to which needs have been updated
  cash: number;
  needs: Needs;
  devOffsetMs: number; // development only: shifts the displayed time, never saved
  tick: (now: number) => void;
  addCash: (amount: number) => void;
  spendCash: (amount: number) => boolean;
  changeNeeds: (delta: Partial<Needs>) => void;
  devShiftHours: (hours: number) => void;
  reset: () => void;
};

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      lastTick: Date.now(),
      cash: 5000,
      needs: INITIAL_NEEDS,
      devOffsetMs: 0,

      // Brings the needs up to date with the real clock.
      // Called every few seconds, and when the player comes back to the tab.
      tick: (now) =>
        set((state) => {
          // Device clock moved backwards: just resync.
          if (now < state.lastTick) return { lastTick: now };

          const elapsedMinutes = Math.floor((now - state.lastTick) / MINUTE_MS);
          if (elapsedMinutes < 1) return state;

          const minutesToApply = Math.min(elapsedMinutes, MAX_CATCH_UP_MINUTES);
          const needs: Needs = { ...state.needs };

          for (let i = 0; i < minutesToApply; i++) {
            const clock = getGameClock(state.lastTick + i * MINUTE_MS);
            const isNight = getDayPhase(clock.hour) === "night";

            for (const key of NEED_KEYS) {
              let drainPerMinute = NEED_META[key].drainPerHour / 60;
              if (key === "energy" && isNight) {
                drainPerMinute *= NIGHT_ENERGY_MULTIPLIER;
              }
              needs[key] = clamp(needs[key] - drainPerMinute);
            }
          }

          // Keep the leftover seconds so no time is lost between ticks.
          return {
            needs,
            lastTick: state.lastTick + elapsedMinutes * MINUTE_MS,
          };
        }),

      addCash: (amount) => set((state) => ({ cash: state.cash + amount })),

      spendCash: (amount) => {
        if (get().cash < amount) return false;
        set((state) => ({ cash: state.cash - amount }));
        return true;
      },

      changeNeeds: (delta) =>
        set((state) => {
          const needs: Needs = { ...state.needs };
          for (const key of NEED_KEYS) {
            const change = delta[key];
            if (change !== undefined) needs[key] = clamp(needs[key] + change);
          }
          return { needs };
        }),

      devShiftHours: (hours) =>
        set((state) => ({ devOffsetMs: state.devOffsetMs + hours * HOUR_MS })),

      reset: () =>
        set({
          lastTick: Date.now(),
          cash: 5000,
          needs: INITIAL_NEEDS,
          devOffsetMs: 0,
        }),
    }),
    {
      name: "osun-life-save-v2",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      // Only save data, not functions or dev settings.
      partialize: (state) => ({
        lastTick: state.lastTick,
        cash: state.cash,
        needs: state.needs,
      }),
      // We load the save ourselves after the page mounts (see GameApp).
      // This avoids a server/client mismatch in Next.js.
      skipHydration: true,
    }
  )
);