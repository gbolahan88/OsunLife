"use client";

import { useState } from "react";
import { Moon, Sun, UserRound, Volume2, VolumeX } from "lucide-react";
import { formatNaira } from "@/lib/format";

type HudProps = {
  time: string;
  mood: string;
  moodEmoji: string;
  cash: number;
  isNight: boolean;
  username: string;
};

export default function Hud({
  time,
  mood,
  moodEmoji,
  cash,
  isNight,
  username,
}: HudProps) {
  const [muted, setMuted] = useState(false);

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 px-3 pt-[calc(env(safe-area-inset-top)+12px)]">
      <div className="mx-auto max-w-190">
        {/* Main HUD */}
        <div className="pointer-events-auto flex items-center justify-between gap-2 rounded-full border border-white/80 bg-white/95 px-3 py-2 shadow-[0_8px_28px_rgba(24,50,39,0.16)] backdrop-blur-md sm:gap-4 sm:px-5">
          {/* Time */}
          <div className="flex shrink-0 items-center gap-1.5 text-xs font-bold sm:gap-2 sm:text-sm">
            {isNight ? (
              <Moon size={17} className="text-[#5d6eaa] sm:h-4.5 sm:w-4.5" />
            ) : (
              <Sun size={17} className="text-[var(--gold)] sm:h-4.5 sm:w-4.5" />
            )}
            <span>{time}</span>
          </div>

          {/* Mood */}
          <div className="flex min-w-0 max-w-[8rem] items-center gap-1.5 text-xs font-semibold text-[var(--accent)] sm:gap-2 sm:text-sm">
            <span className="shrink-0">{moodEmoji}</span>
            <span className="max-w-[4.5rem] truncate sm:max-w-[8rem]">
              {mood}
            </span>
          </div>

          {/* Visits and online: desktop only */}
          <div className="hidden items-center gap-5 sm:flex">
            <span className="whitespace-nowrap text-[13px]">
              👀 2 visits
            </span>

            <span className="whitespace-nowrap text-[13px]">
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#20b978]" />
              1 online
            </span>
          </div>

          {/* Sound */}
          <button
            type="button"
            onClick={() => setMuted((current) => !current)}
            aria-label={muted ? "Unmute" : "Mute"}
            aria-pressed={muted}
            className="pointer-events-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--mute)] transition-colors hover:bg-[#f0f5f0]"
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          {/* Username */}
          <div className="flex max-w-[8rem] items-center gap-1.5 text-xs sm:max-w-[12rem] sm:text-sm">
            <UserRound
              size={13}
              className="shrink-0 text-[#26724f]"
            />
            <span className="truncate">{username}</span>
          </div>

          {/* Cash */}
          <div className="flex min-w-0 items-center rounded-full bg-[#f2f6f1] px-2.5 py-1 sm:px-3">
            <span className="truncate text-[11px] font-extrabold tabular-nums sm:text-sm">
              {formatNaira(cash)}
            </span>
          </div>
        </div>

        {/* Visits and online: separate blurred pill on mobile */}
        <div className="pointer-events-auto mx-auto mt-2 flex w-fit items-center justify-center gap-5 rounded-full border border-white/30 bg-white/65 px-4 py-1.5 text-[11px] font-semibold text-[#506258] shadow-[0_4px_16px_rgba(24,50,39,0.10)] backdrop-blur-xl sm:hidden">
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <span aria-hidden="true">👀</span>
            <span>2 visits</span>
          </span>

          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="inline-block h-2 w-2 rounded-full bg-[#20b978]" />
            <span>1 online</span>
          </span>
        </div>
      </div>
    </header>
  );
}
