"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Hud from "./Hud";
import BottomNav, { type Tab } from "./BottomNav";
import DayNightOverlay from "./DayNightOverlay";
import NeedsPanel from "./NeedsPanel";
import HomeInterior from "./HomeInterior";
import BuildingInterior from "./game/BuildingInterior";
import PlayerProfilePopup from "@/components/PlayerProfilePopup";
import FurnitureShop from "@/components/game/FurnitureShop";
import MapTasks from "@/components/game/MapTasks";
import PhonePopup from "@/components/game/PhonePopup";
import RentPopup from "@/components/Rentpopup";
import { SAVE_KEY_PREFIX, useGameStore } from "@/store/gameStore";
import { MAP_TASKS } from "@/lib/mapTasks";
import { formatNaira } from "@/lib/format";
import { useGameLoop } from "@/hooks/useGameLoop";
import { useNow } from "@/hooks/useNow";
import { getMood } from "@/lib/needs";
import OsogboWorld from "@/components/OsogboWorld";
import { formatClock, getDayPhase, getGameClock } from "@/lib/time";
import {
  CharacterAppearance,
  DEFAULT_CHARACTER_APPEARANCE,
} from "@/store/characterAppearance";

const APPEARANCE_KEY_PREFIX = "osun-life:appearance";

function loadAppearance(username: string): CharacterAppearance {
  if (typeof window === "undefined") return DEFAULT_CHARACTER_APPEARANCE;
  try {
    const stored = window.localStorage.getItem(
      `${APPEARANCE_KEY_PREFIX}:${username}`
    );
    if (!stored) return DEFAULT_CHARACTER_APPEARANCE;
    return { ...DEFAULT_CHARACTER_APPEARANCE, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_CHARACTER_APPEARANCE;
  }
}

export default function GameApp({ username }: { username: string }) {
  const [tab, setTab] = useState<Tab>("map");
  const [lastBuilding, setLastBuilding] = useState("Tobi's House");
  const [lastBuildingId, setLastBuildingId] = useState("home");
  const [loadedUsername, setLoadedUsername] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isRentOpen, setIsRentOpen] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [isEditingFurniture, setIsEditingFurniture] = useState(false);
  const [appearance, setAppearance] = useState<CharacterAppearance>(() =>
    loadAppearance(username)
  );

  const lastAppearanceUsername = useRef<string>(username);

  const cash = useGameStore((s) => s.cash);
  const needs = useGameStore((s) => s.needs);
  const devOffsetMs = useGameStore((s) => s.devOffsetMs);
  const housing = useGameStore((s) => s.housing);
  const furniture = useGameStore((s) => s.furniture);
  const loan = useGameStore((s) => s.loan);
  const loanTaken = useGameStore((s) => s.loanTaken);
  const completedTasks = useGameStore((s) => s.completedMapTasks);
  const rentHome = useGameStore((s) => s.rentHome);
  const sleepRough = useGameStore((s) => s.sleepRough);
  const buyFurniture = useGameStore((s) => s.buyFurniture);
  const sellFurniture = useGameStore((s) => s.sellFurniture);
  const completeMapTask = useGameStore((s) => s.completeMapTask);
  const repayLoan = useGameStore((s) => s.repayLoan);
  const [taskNotice, setTaskNotice] = useState<string | null>(null);

  const now = useNow(1000);
  const ready = loadedUsername === username;

  useEffect(() => {
    let active = true;
    useGameStore.persist.setOptions({
      name: `${SAVE_KEY_PREFIX}:${username}`,
    });
    void Promise.resolve(useGameStore.persist.rehydrate())
      .catch((error: unknown) =>
        console.error("[GameApp] Save hydration failed:", error)
      )
      .finally(() => {
        if (active) setLoadedUsername(username);
      });
    return () => {
      active = false;
    };
  }, [username]);

  useEffect(() => {
    if (lastAppearanceUsername.current === username) return;
    lastAppearanceUsername.current = username;
    setAppearance(loadAppearance(username));
  }, [username]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(
        `${APPEARANCE_KEY_PREFIX}:${username}`,
        JSON.stringify(appearance)
      );
    } catch (error) {
      console.error("[GameApp] Failed to save appearance:", error);
    }
  }, [appearance, username, ready]);

  const handleUpdateAppearance = (
    key: keyof CharacterAppearance,
    value: string
  ) => {
    setAppearance((prev) => ({ ...prev, [key]: value }));
  };

  // ✅ Stable callback — never fires during render
  const handleEditingChange = useCallback((editing: boolean) => {
    setIsEditingFurniture(editing);
  }, []);

  useGameLoop(ready);

  useEffect(() => {
    if (!taskNotice) return;
    const timeout = window.setTimeout(() => setTaskNotice(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [taskNotice]);

  function handleTabChange(newTab: Tab) {
    if (newTab === "buy") {
      // Inside home: internal Buy Mode handles it, do nothing here
      if (tab === "home") return;
      setTab("buy");
      return;
    }
    setTab(newTab);
  }

  if (!ready) {
    return (
      <div className="flex h-dvh items-center justify-center text-lg font-bold text-[var(--accent)]">
        Osun Life…
      </div>
    );
  }

  const clock = getGameClock(now + devOffsetMs);
  const phase = getDayPhase(clock.hour);
  const mood = getMood(needs);

  return (
    <div className="flex h-dvh w-full flex-col">
      <div className="relative h-full overflow-hidden bg-[var(--bg)]">
        <DayNightOverlay phase={phase} />

        <Hud
          time={formatClock(clock)}
          mood={mood.label}
          moodEmoji={mood.emoji}
          cash={cash}
          isNight={phase === "night"}
          username={username}
        />

        {tab === "map" && (
          <OsogboWorld
            active={true}
            appearance={appearance}
            onEnterBuilding={(buildingName, buildingId) => {
              const task = MAP_TASKS.find(
                (entry) => entry.targetBuildingId === buildingId
              );
              if (task) {
                const result = completeMapTask(task.id, Date.now());
                setTaskNotice(
                  result.ok
                    ? `${task.title}: +${formatNaira(task.reward)}`
                    : result.reason
                );
              }
              setLastBuilding(buildingName);
              setLastBuildingId(buildingId);
              setTab("home");
            }}
          />
        )}

        {tab === "map" && (
          <MapTasks completedTasks={completedTasks} now={now} />
        )}

        {tab === "buy" && (
          <FurnitureShop
            cash={cash}
            housing={housing}
            furniture={furniture}
            onBuy={buyFurniture}
            onSell={sellFurniture}
            onFindHome={() => setIsRentOpen(true)}
            onClose={() => setTab("map")}
          />
        )}

        {tab === "home" &&
          (lastBuildingId === "home" || lastBuildingId === "okefia") && (
            <HomeInterior
              key={lastBuildingId}
              buildingName={lastBuilding}
              housing={housing}
              furniture={furniture}
              loan={loan}
              cash={cash}
              appearance={appearance}
              isNight={phase === "night"}
              onExit={() => setTab("map")}
              onFindHome={() => setIsRentOpen(true)}
              onRepayLoan={repayLoan}
              onEditingChange={handleEditingChange}
            />
          )}

        {tab === "home" &&
          lastBuildingId !== "home" &&
          lastBuildingId !== "okefia" && (
            <BuildingInterior
              key={lastBuildingId}
              buildingId={lastBuildingId}
              buildingName={lastBuilding}
              onExit={() => setTab("map")}
            />
          )}

        {isShopOpen && (
          <FurnitureShop
            cash={cash}
            housing={housing}
            furniture={furniture}
            onBuy={buyFurniture}
            onSell={sellFurniture}
            onFindHome={() => {
              setIsShopOpen(false);
              setIsRentOpen(true);
            }}
            onClose={() => setIsShopOpen(false)}
          />
        )}

        {(housing === "undecided" || isRentOpen) && (
          <RentPopup
            cash={cash}
            loanTaken={loanTaken}
            canClose={housing !== "undecided"}
            onRent={(planId, takeLoan) => {
              const result = rentHome(planId, takeLoan);
              if (result.ok) {
                setIsRentOpen(false);
                setLastBuilding("Your home");
                setLastBuildingId("home");
                setTab("home");
              }
              return result;
            }}
            onSleepRough={() => {
              sleepRough();
              setIsRentOpen(false);
              setLastBuilding("Under the Okefia Flyover");
              setLastBuildingId("okefia");
              setTab("home");
            }}
            onClose={() => setIsRentOpen(false)}
          />
        )}

        {!isEditingFurniture && (
          <NeedsPanel
            needs={needs}
            appearance={appearance}
            onProfileClick={() => setIsProfileOpen(true)}
          />
        )}

        {isProfileOpen && (
          <PlayerProfilePopup
            username={username}
            cash={cash}
            needs={needs}
            appearance={appearance}
            onUpdateAppearance={handleUpdateAppearance}
            onClose={() => setIsProfileOpen(false)}
          />
        )}

        {taskNotice && (
          <div
            role="status"
            className="absolute left-1/2 top-24 z-50 flex max-w-[calc(100%-24px)] -translate-x-1/2 items-center gap-3 rounded-full border border-white/80 bg-white/95 px-4 py-2.5 text-xs font-bold text-[#26724f] shadow-lg"
          >
            <span className="truncate">{taskNotice}</span>
            <button
              type="button"
              onClick={() => setTaskNotice(null)}
              aria-label="Dismiss notice"
              className="shrink-0 text-[#718276]"
            >
              ×
            </button>
          </div>
        )}

        {tab === "phone" && (
          <PhonePopup
            username={username}
            cash={cash}
            onClose={() => setTab("map")}
          />
        )}

        {!isEditingFurniture && (
          <BottomNav active={tab} onChange={handleTabChange} />
        )}
      </div>
    </div>
  );
}