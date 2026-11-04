// components/RideBar.tsx
"use client";

import { useEffect, useState, type MutableRefObject } from "react";
import { SkipForward } from "lucide-react";

export default function RideBar({
  emoji,
  modeName,
  destination,
  progressRef,
  onSkip,
}: {
  emoji: string;
  modeName: string;
  destination: string;
  /** 0 to 1, written by the map player every frame */
  progressRef: MutableRefObject<number>;
  onSkip: () => void;
}) {
  const [progress, setProgress] = useState(0);

  // Read the ref a few times a second instead of re-rendering every frame
  useEffect(() => {
    const id = window.setInterval(() => setProgress(progressRef.current), 150);
    return () => window.clearInterval(id);
  }, [progressRef]);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+7.25rem)] z-30 flex justify-center px-3">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#141f2b]/90 text-white shadow-xl backdrop-blur-md"
      >
        <div className="flex items-center gap-3 px-4 py-2.5">
          <span className="text-xl" aria-hidden>{emoji}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-extrabold">On the way to {destination}…</p>
            <p className="text-[10px] font-semibold text-white/55">{modeName}</p>
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white/12 px-3.5 text-[12px] font-extrabold text-white transition-colors hover:bg-white/20"
          >
            <SkipForward size={14} />
            Skip
          </button>
        </div>
        <div className="h-1 bg-white/10">
          <div
            className="h-full bg-[#20b978] transition-[width] duration-150"
            style={{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}