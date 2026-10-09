
"use client";

import { motion } from "framer-motion";
import { NEED_KEYS, NEED_META, type Needs } from "@/lib/needs";

export default function NeedsPanel({
  needs,
  onProfileClick,
}: {
  needs: Needs;
  onProfileClick: () => void;
}) {
  return (
    <section
      aria-label="Needs"
      className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+88px)] z-20 px-4"
    >
      <div className="mx-auto flex max-w-[420px] items-center gap-2.5">
        {/* Clickable player profile */}
        <button
          type="button"
          onClick={onProfileClick}
          aria-label="Open player profile, needs, goals, skills and settings"
          title="Player profile"
          className="pointer-events-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-[3px] border-white bg-[#20b978] text-2xl shadow-[0_5px_18px_rgba(20,60,43,0.25)] ring-1 ring-[#20b978] transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#168e5b] active:scale-95"
        >
          👨‍🦱
        </button>

        {/* Existing needs indicators */}
        <div className="pointer-events-auto grid flex-1 grid-cols-3 gap-x-3 gap-y-2 rounded-full border border-white/90 bg-white/95 px-3 py-2.5 shadow-[0_8px_26px_rgba(24,50,39,0.17)] backdrop-blur-md">
          {NEED_KEYS.map((key) => {
            const { emoji, label } = NEED_META[key];
            const value = needs[key];
            const low = value < 25;

            return (
              <div
                key={key}
                className="flex min-w-0 items-center gap-1.5"
                title={`${label}: ${Math.round(value)}%`}
              >
                <span className="shrink-0 text-sm leading-none">{emoji}</span>

                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e6eee7]">
                  <motion.div
                    className="h-full"
                    style={{
                      backgroundColor: low ? "#df6652" : "#20b978",
                    }}
                    initial={false}
                    animate={{ width: `${value}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}