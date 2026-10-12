"use client";

import { useEffect, useState } from "react";
import Hud from "./Hud";
import BottomNav, { type Tab } from "./BottomNav";
import DayNightOverlay from "./DayNightOverlay";
import NeedsPanel from "./NeedsPanel";
import HomeInterior from "./HomeInterior";
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
import {
  formatClock,
  getDayPhase,
  getGameClock,
} from "@/lib/time";

export default function GameApp({ username }: { username: string }) {
  const [tab, setTab] = useState<Tab>("map");
  const [lastBuilding, setLastBuilding] = useState("Tobi's House");
  const [loadedUsername, setLoadedUsername] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isRentOpen, setIsRentOpen] = useState(false);

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
  const completeMapTask = useGameStore((s) => s.completeMapTask);
  const repayLoan = useGameStore((s) => s.repayLoan);
  const [taskNotice, setTaskNotice] = useState<string | null>(null);

  const now = useNow(1000);
  const ready = loadedUsername === username;

  // Each account gets its own save; hydration starts from a fresh-player state.
  useEffect(() => {
    let active = true;
    useGameStore.persist.setOptions({ name: `${SAVE_KEY_PREFIX}:${username}` });
    void Promise.resolve(useGameStore.persist.rehydrate())
      .catch((error: unknown) => console.error("[GameApp] Save hydration failed:", error))
      .finally(() => {
        if (active) setLoadedUsername(username);
      });
    return () => {
      active = false;
    };
  }, [username]);

  useGameLoop(ready);

  useEffect(() => {
    if (!taskNotice) return;
    const timeout = window.setTimeout(() => setTaskNotice(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [taskNotice]);

  if (!ready) {
    return (
      <div className="flex h-dvh items-center justify-center text-sm text-9xl font-bold text-[var(--accent)]">
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

        <OsogboWorld
          active={tab === "map"}
          onEnterBuilding={(buildingName, buildingId) => {
            const task = MAP_TASKS.find((entry) => entry.targetBuildingId === buildingId);
            if (task) {
              const result = completeMapTask(task.id, Date.now());
              setTaskNotice(result.ok
                ? `${task.title}: +${formatNaira(task.reward)}`
                : result.reason);
            }
            setLastBuilding(buildingName);
            setTab("home");
          }}
        />

        {tab === "map" && <MapTasks completedTasks={completedTasks} now={now} />}

        {tab === "buy" && (
          <FurnitureShop
            cash={cash}
            housing={housing}
            furniture={furniture}
            onBuy={buyFurniture}
            onFindHome={() => setIsRentOpen(true)}
          />
        )}

        {tab === "home" && (
          <HomeInterior
            buildingName={lastBuilding}
            housing={housing}
            furniture={furniture}
            loan={loan}
            cash={cash}
            onExit={() => setTab("map")}
            onFindHome={() => setIsRentOpen(true)}
            onRepayLoan={repayLoan}
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
                setTab("home");
              }
              return result;
            }}
            onSleepRough={() => {
              sleepRough();
              setIsRentOpen(false);
              setLastBuilding("Under the Okefia Flyover");
              setTab("home");
            }}
            onClose={() => setIsRentOpen(false)}
          />
        )}

        <NeedsPanel
          needs={needs}
          onProfileClick={() => setIsProfileOpen(true)}
        />

        {isProfileOpen && (
          <PlayerProfilePopup
            username={username}
            cash={cash}
            needs={needs}
            onClose={() => setIsProfileOpen(false)}
          />
        )}

        {taskNotice && (
          <div role="status" className="absolute left-1/2 top-24 z-50 flex max-w-[calc(100%-24px)] -translate-x-1/2 items-center gap-3 rounded-full border border-white/80 bg-white/95 px-4 py-2.5 text-xs font-bold text-[#26724f] shadow-lg">
            <span className="truncate">{taskNotice}</span>
            <button type="button" onClick={() => setTaskNotice(null)} aria-label="Dismiss notice" className="shrink-0 text-[#718276]">×</button>
          </div>
        )}

        {tab === "phone" && (
          <PhonePopup
            username={username}
            cash={cash}
            onClose={() => setTab("map")}
          />
        )}

        <BottomNav active={tab} onChange={setTab} />
      </div>
    </div>
  );
}