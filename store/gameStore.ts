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
import {
  getHousingPlan,
  isHousingPlanId,
  LOAN_OFFER,
  type HousingPlanId,
  type HousingStatus,
} from "@/lib/housing";
import { getApartmentLayout } from "@/lib/apartmentConfig";
import { FURNITURE_BY_ID, findSpot, type PlacedFurniture } from "@/lib/furniture";
import { MAP_TASKS, MAP_TASK_COOLDOWN_MS } from "@/lib/mapTasks";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

// If a player is away longer than this, we only apply this much drain.
const MAX_CATCH_UP_MINUTES = 8 * 60;

const STARTING_CASH = 5000;

function createInitialSave(lastTick = 0) {
  return {
    lastTick,
    cash: STARTING_CASH,
    needs: { ...INITIAL_NEEDS },
    housing: "undecided" as HousingStatus,
    loan: 0,
    loanTaken: false,
    furniture: [] as PlacedFurniture[],
    completedMapTasks: {} as Record<string, number>,
    devOffsetMs: 0,
  };
}

export type ActionResult = { ok: true } | { ok: false; reason: string };

type GameState = {
  lastTick: number; // timestamp (ms) up to which needs have been updated
  cash: number;
  needs: Needs;
  housing: HousingStatus;
  loan: number; // money still owed
  loanTaken: boolean; // the starter loan can only be taken once
  furniture: PlacedFurniture[];
  completedMapTasks: Record<string, number>;
  devOffsetMs: number; // development only: shifts the displayed time, never saved
  tick: (now: number) => void;
  addCash: (amount: number) => void;
  spendCash: (amount: number) => boolean;
  changeNeeds: (delta: Partial<Needs>) => void;
  rentHome: (planId: HousingPlanId, takeLoan: boolean) => ActionResult;
  sleepRough: () => void;
  buyFurniture: (itemId: string) => ActionResult;
  completeMapTask: (taskId: string, completedAt?: number) => ActionResult;
  repayLoan: () => number;
  devShiftHours: (hours: number) => void;
  reset: () => void;
};

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      ...createInitialSave(),

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

      // Pays the rent (once) and moves the player in to an empty home.
      // If takeLoan is true and the starter loan is still available, the loan
      // money is added first, so it can cover the rent.
      rentHome: (planId, takeLoan) => {
        const state = get();
        if (isHousingPlanId(state.housing)) {
          return { ok: false, reason: "You already have a home." };
        }

        const plan = getHousingPlan(planId);
        const useLoan = takeLoan && !state.loanTaken;
        const available = state.cash + (useLoan ? LOAN_OFFER : 0);

        if (available < plan.price) {
          return { ok: false, reason: "You can't afford this place yet." };
        }

        set({
          cash: available - plan.price,
          loan: state.loan + (useLoan ? LOAN_OFFER : 0),
          loanTaken: state.loanTaken || useLoan,
          housing: planId,
          furniture: [],
        });
        return { ok: true };
      },

      sleepRough: () => set({ housing: "homeless", furniture: [] }),

      // Buys an item and places it on the first free tiles of a suitable room.
      // Nothing is charged when there is no space.
      buyFurniture: (itemId) => {
        const state = get();
        const item = FURNITURE_BY_ID[itemId];
        if (!item) return { ok: false, reason: "That item isn't available." };
        if (!isHousingPlanId(state.housing)) {
          return { ok: false, reason: "You need a home first." };
        }
        if (state.cash < item.price) {
          return { ok: false, reason: "Not enough cash." };
        }

        const layout = getApartmentLayout(state.housing);
        const spot = findSpot(layout, state.furniture, item);
        if (!spot) {
          return { ok: false, reason: "No free tiles for this in your home." };
        }

        const uid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        set({
          cash: state.cash - item.price,
          furniture: [...state.furniture, { uid, itemId, ...spot }],
        });
        return { ok: true };
      },

      completeMapTask: (taskId, completedAt = Date.now()) => {
        const task = MAP_TASKS.find((entry) => entry.id === taskId);
        if (!task) return { ok: false, reason: "That task isn't available." };

        const state = get();
        const availableAt = (state.completedMapTasks[taskId] ?? 0) + MAP_TASK_COOLDOWN_MS;
        if (availableAt > completedAt) {
          return { ok: false, reason: "This task will be available again tomorrow." };
        }

        set({
          cash: state.cash + task.reward,
          completedMapTasks: { ...state.completedMapTasks, [taskId]: completedAt },
        });
        return { ok: true };
      },

      // Pays back as much of the loan as the player can afford. Returns the amount paid.
      repayLoan: () => {
        const { cash, loan } = get();
        const amount = Math.min(cash, loan);
        if (amount <= 0) return 0;
        set({ cash: cash - amount, loan: loan - amount });
        return amount;
      },

      devShiftHours: (hours) =>
        set((state) => ({ devOffsetMs: state.devOffsetMs + hours * HOUR_MS })),

      reset: () =>
        set({
          ...createInitialSave(Date.now()),
        }),
    }),
    {
      // GameApp gives each player their own key: `${SAVE_KEY_PREFIX}:${username}`.
      name: "osun-life-save-v2",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      // Only save data, not functions or dev settings.
      // Older saves without the housing fields get the defaults above.
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...createInitialSave(Date.now()),
        ...(persistedState as Partial<GameState> | undefined),
      }),
      partialize: (state) => ({
        lastTick: state.lastTick,
        cash: state.cash,
        needs: state.needs,
        housing: state.housing,
        loan: state.loan,
        loanTaken: state.loanTaken,
        furniture: state.furniture,
        completedMapTasks: state.completedMapTasks,
      }),
      // We load the save ourselves after the page mounts (see GameApp).
      // This avoids a server/client mismatch in Next.js.
      skipHydration: true,
    }
  )
);

export const SAVE_KEY_PREFIX = "osun-life-save-v2";