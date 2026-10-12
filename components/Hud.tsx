"use client";

import { useState } from "react";
import { LogOut, Moon, Sun, UserRound, Volume2, VolumeX } from "lucide-react";
import { formatNaira } from "@/lib/format";
import { signOut } from "@/app/auth-actions";

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
      <div className="mx-auto max-w-[760px]">
        <div className="pointer-events-auto flex items-center justify-between gap-2 rounded-full border border-white/80 bg-white/95 px-3 py-2 shadow-[0_8px_28px_rgba(24,50,39,0.16)] backdrop-blur-md sm:gap-4 sm:px-5">
        <div className="flex shrink-0 items-center gap-1.5 text-xs font-bold sm:gap-2 sm:text-sm">
          {isNight ? (
            <Moon size={17} className="text-[#5d6eaa] sm:h-[18px] sm:w-[18px]" />
          ) : (
            <Sun size={17} className="text-[var(--gold)] sm:h-[18px] sm:w-[18px]" />
          )}
          <span>{time}</span>
        </div>

        <div className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-[var(--accent)] sm:gap-2 sm:text-sm">
          <span className="shrink-0">{moodEmoji}</span>
          <span className="max-w-[4.5rem] truncate sm:max-w-[8rem]">{mood}</span>
        </div>

        <button
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "Unmute" : "Mute"}
          className="pointer-events-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--mute)] transition-colors hover:bg-[#f0f5f0]"
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>

        <div className="flex min-w-0 items-center rounded-full bg-[#f2f6f1] px-2.5 py-1 sm:px-3">
          <span className="truncate text-[11px] font-extrabold tabular-nums sm:text-sm">{formatNaira(cash)}</span>
        </div>
      </div>

      <div className="pointer-events-auto mt-2 flex items-center justify-between gap-2 text-[11px] font-semibold text-[#506258]">
        <span className="flex min-w-0 max-w-[8rem] items-center gap-1.5 rounded-full border border-white/70 bg-white/90 px-2.5 py-1 shadow-sm backdrop-blur sm:max-w-[12rem] sm:px-3">
          <UserRound size={13} className="shrink-0 text-[#26724f]" />
          <span className="truncate">{username}</span>
        </span>
        <div className="hidden items-center gap-2 sm:flex">
        <span className="rounded-full border border-white/70 bg-white/90 px-3 py-1 shadow-sm backdrop-blur">
          👀 24.7k visits
        </span>
        <span className="rounded-full border border-white/70 bg-white/90 px-3 py-1 shadow-sm backdrop-blur">
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#20b978]" />
          68k online
        </span>
        </div>
        <form action={signOut}>
          <button type="submit" aria-label="Sign out" title="Sign out" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/90 text-[#506258] shadow-sm transition-colors hover:bg-white hover:text-[#a14836] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#26724f]">
            <LogOut size={15} />
          </button>
        </form>
      </div>
      </div>
    </header>
  );
}