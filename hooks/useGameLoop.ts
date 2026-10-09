"use client";

import { useEffect } from "react";
import { useGameStore } from "@/store/gameStore";

// Keeps the needs in step with the real clock.
// Runs once straight away (this is the offline catch-up),
// then every 5 seconds, and again whenever the tab becomes visible.
export function useGameLoop(enabled: boolean) {
  const tick = useGameStore((s) => s.tick);

  useEffect(() => {
    if (!enabled) return;

    const run = () => tick(Date.now());
    run();

    const id = setInterval(run, 5000);

    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, tick]);
}