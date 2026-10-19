
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
import {
  FURNITURE_BY_ID,
  findSpot,
  validateFurniturePlacement,
  type FurniturePosition,
  type PlacedFurniture,
} from "@/lib/furniture";
import { MAP_TASKS, MAP_TASK_COOLDOWN_MS } from "@/lib/mapTasks";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const MAX_CATCH_UP_MINUTES = 8 * 60;
const STARTING_CASH = 100000;

/**
 * Customisable appearance for the player's 3D character.
 *
 * The scene can use these colours when rendering the moving player.
 */
export type CharacterAppearance = {
  skin: string;
  hair: string;
  shirt: string;
  trousers: string;
  hairstyle: "short" | "afro" | "braids";
};

export const DEFAULT_CHARACTER_APPEARANCE: CharacterAppearance = {
  skin: "#70472f",
  hair: "#211d1a",
  shirt: "#2876b9",
  trousers: "#252f45",
  hairstyle: "short",
};

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
    characterAppearance: { ...DEFAULT_CHARACTER_APPEARANCE },
  };
}

export type ActionResult = { ok: true } | { ok: false; reason: string };

type GameState = {
  lastTick: number;
  cash: number;
  needs: Needs;
  housing: HousingStatus;
  loan: number;
  loanTaken: boolean;
  furniture: PlacedFurniture[];
  completedMapTasks: Record<string, number>;
  devOffsetMs: number;

  characterAppearance: CharacterAppearance;
  updateCharacterAppearance: (
    appearance: Partial<CharacterAppearance>,
  ) => void;

  tick: (now: number) => void;
  addCash: (amount: number) => void;
  spendCash: (amount: number) => boolean;
  changeNeeds: (delta: Partial<Needs>) => void;
  rentHome: (planId: HousingPlanId, takeLoan: boolean) => ActionResult;
  sleepRough: () => void;
  buyFurniture: (itemId: string) => ActionResult;
  moveFurniture: (
    uid: string,
    position: FurniturePosition,
  ) => ActionResult;
  rotateFurniture: (uid: string) => ActionResult;
  completeMapTask: (taskId: string, completedAt?: number) => ActionResult;
  repayLoan: () => number;
  devShiftHours: (hours: number) => void;
  reset: () => void;
};

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      ...createInitialSave(),

      /**
       * Updates only the supplied appearance properties.
       * Unchanged properties keep their existing values.
       */
      updateCharacterAppearance: (appearance) =>
        set((state) => ({
          characterAppearance: {
            ...state.characterAppearance,
            ...appearance,
          },
        })),

      tick: (now) =>
        set((state) => {
          if (now < state.lastTick) return { lastTick: now };

          const elapsedMinutes = Math.floor(
            (now - state.lastTick) / MINUTE_MS,
          );

          if (elapsedMinutes < 1) return state;

          const minutesToApply = Math.min(
            elapsedMinutes,
            MAX_CATCH_UP_MINUTES,
          );
          const needs: Needs = { ...state.needs };

          for (let i = 0; i < minutesToApply; i++) {
            const clock = getGameClock(
              state.lastTick + i * MINUTE_MS,
            );
            const isNight = getDayPhase(clock.hour) === "night";

            for (const key of NEED_KEYS) {
              let drainPerMinute = NEED_META[key].drainPerHour / 60;

              if (key === "energy" && isNight) {
                drainPerMinute *= NIGHT_ENERGY_MULTIPLIER;
              }

              needs[key] = clamp(needs[key] - drainPerMinute);
            }
          }

          return {
            needs,
            lastTick: state.lastTick + elapsedMinutes * MINUTE_MS,
          };
        }),

      addCash: (amount) =>
        set((state) => ({ cash: state.cash + amount })),

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

            if (change !== undefined) {
              needs[key] = clamp(needs[key] + change);
            }
          }

          return { needs };
        }),

      rentHome: (planId, takeLoan) => {
        const state = get();

        if (isHousingPlanId(state.housing)) {
          return { ok: false, reason: "You already have a home." };
        }

        const plan = getHousingPlan(planId);
        const useLoan = takeLoan && !state.loanTaken;
        const available = state.cash + (useLoan ? LOAN_OFFER : 0);

        if (available < plan.price) {
          return {
            ok: false,
            reason: "You can't afford this place yet.",
          };
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

      sleepRough: () =>
        set({
          housing: "homeless",
          furniture: [],
        }),

      buyFurniture: (itemId) => {
        const state = get();
        const item = FURNITURE_BY_ID[itemId];

        if (!item) {
          return { ok: false, reason: "That item isn't available." };
        }

        if (!isHousingPlanId(state.housing)) {
          return { ok: false, reason: "You need a home first." };
        }

        if (state.cash < item.price) {
          return { ok: false, reason: "Not enough cash." };
        }

        const layout = getApartmentLayout(state.housing);
        const spot = findSpot(layout, state.furniture, item);

        if (!spot) {
          return {
            ok: false,
            reason: "No free tiles for this in your home.",
          };
        }

        const uid = `${Date.now().toString(36)}-${Math.random()
          .toString(36)
          .slice(2, 8)}`;

        set({
          cash: state.cash - item.price,
          furniture: [
            ...state.furniture,
            { uid, itemId, ...spot },
          ],
        });

        return { ok: true };
      },

      // Moves purchased furniture to another tile or room.
      // The furniture remains saved using the existing persistence system.
      moveFurniture: (uid, position) => {
        const state = get();

        if (!isHousingPlanId(state.housing)) {
          return { ok: false, reason: "You need a home first." };
        }

        const existing = state.furniture.find(
          (entry) => entry.uid === uid,
        );

        if (!existing) {
          return { ok: false, reason: "Furniture not found." };
        }

        const item = FURNITURE_BY_ID[existing.itemId];

        if (!item) {
          return {
            ok: false,
            reason: "Furniture definition not found.",
          };
        }

        const layout = getApartmentLayout(state.housing);

        const result = validateFurniturePlacement(
          layout,
          state.furniture,
          item,
          position,
          uid,
        );

        if (!result.ok) {
          return {
            ok: false,
            reason: result.reason ?? "Invalid furniture position.",
          };
        }

        set({
          furniture: state.furniture.map((entry) =>
            entry.uid === uid
              ? { ...entry, ...position }
              : entry,
          ),
        });

        return { ok: true };
      },

      // Rotates furniture only when the rotated footprint fits.
      rotateFurniture: (uid) => {
        const state = get();

        if (!isHousingPlanId(state.housing)) {
          return { ok: false, reason: "You need a home first." };
        }

        const existing = state.furniture.find(
          (entry) => entry.uid === uid,
        );

        if (!existing) {
          return { ok: false, reason: "Furniture not found." };
        }

        const item = FURNITURE_BY_ID[existing.itemId];

        if (!item) {
          return {
            ok: false,
            reason: "Furniture definition not found.",
          };
        }

        if (item.w === item.d) {
          return { ok: true };
        }

        const layout = getApartmentLayout(state.housing);
        const position: FurniturePosition = {
          roomId: existing.roomId,
          col: existing.col,
          row: existing.row,
          rotated: !existing.rotated,
        };

        const result = validateFurniturePlacement(
          layout,
          state.furniture,
          item,
          position,
          uid,
        );

        if (!result.ok) {
          return {
            ok: false,
            reason: result.reason ?? "Furniture cannot rotate here.",
          };
        }

        set({
          furniture: state.furniture.map((entry) =>
            entry.uid === uid
              ? { ...entry, rotated: position.rotated }
              : entry,
          ),
        });

        return { ok: true };
      },

      completeMapTask: (taskId, completedAt = Date.now()) => {
        const task = MAP_TASKS.find(
          (entry) => entry.id === taskId,
        );

        if (!task) {
          return { ok: false, reason: "That task isn't available." };
        }

        const state = get();
        const availableAt =
          (state.completedMapTasks[taskId] ?? 0) +
          MAP_TASK_COOLDOWN_MS;

        if (availableAt > completedAt) {
          return {
            ok: false,
            reason: "This task will be available again tomorrow.",
          };
        }

        set({
          cash: state.cash + task.reward,
          completedMapTasks: {
            ...state.completedMapTasks,
            [taskId]: completedAt,
          },
        });

        return { ok: true };
      },

      repayLoan: () => {
        const { cash, loan } = get();
        const amount = Math.min(cash, loan);

        if (amount <= 0) return 0;

        set({
          cash: cash - amount,
          loan: loan - amount,
        });

        return amount;
      },

      devShiftHours: (hours) =>
        set((state) => ({
          devOffsetMs: state.devOffsetMs + hours * HOUR_MS,
        })),

      reset: () =>
        set({
          ...createInitialSave(Date.now()),
        }),
    }),
    {
      name: "osun-life-save-v2",
      version: 2,
      storage: createJSONStorage(() => localStorage),

      // Keeps old saves compatible and supplies defaults for newly added
      // appearance fields when a save was created before character editing.
      merge: (persistedState, currentState) => {
        const persisted = persistedState as
          | (Partial<GameState> & {
              characterAppearance?: Partial<CharacterAppearance>;
            })
          | undefined;

        return {
          ...currentState,
          ...createInitialSave(Date.now()),
          ...persisted,
          characterAppearance: {
            ...DEFAULT_CHARACTER_APPEARANCE,
            ...(persisted?.characterAppearance ?? {}),
          },
        };
      },

      partialize: (state) => ({
        lastTick: state.lastTick,
        cash: state.cash,
        needs: state.needs,
        housing: state.housing,
        loan: state.loan,
        loanTaken: state.loanTaken,
        furniture: state.furniture,
        completedMapTasks: state.completedMapTasks,
        characterAppearance: state.characterAppearance,
      }),

      skipHydration: true,
    },
  ),
);

export const SAVE_KEY_PREFIX = "osun-life-save-v2";
