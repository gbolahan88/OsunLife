"use client";

import { useEffect, useState } from "react";
import Hud from "./Hud";
import BottomNav, { type Tab } from "./BottomNav";
import DayNightOverlay from "./DayNightOverlay";
import NeedsPanel from "./NeedsPanel";
import HomeInterior from "./HomeInterior";
import PlayerProfilePopup from "@/components/PlayerProfilePopup";
import PhonePopup from "@/components/game/PhonePopup";
import { useGameStore } from "@/store/gameStore";
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
  const [ready, setReady] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const cash = useGameStore((s) => s.cash);
  const needs = useGameStore((s) => s.needs);
  const devOffsetMs = useGameStore((s) => s.devOffsetMs);
  const addCash = useGameStore((s) => s.addCash);

  const now = useNow(1000);

  // Load the saved game once, after the page has mounted.
  useEffect(() => {
    Promise.resolve(useGameStore.persist.rehydrate()).then(() =>
      setReady(true)
    );
  }, []);

  useGameLoop(ready);

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
          onAddCash={() => addCash(1000)}
        />

        <OsogboWorld
          active={tab === "map"}
          onEnterBuilding={(buildingName) => {
            setLastBuilding(buildingName);
            setTab("home");
          }}
        />

        {tab === "home" && (
          <HomeInterior
            buildingName={lastBuilding}
            onExit={() => setTab("map")}
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