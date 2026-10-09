
"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Heart,
  Target,
  UserRound,
  Zap,
  Settings,
  X,
  Coins,
  Sparkles,
  LockKeyhole,
} from "lucide-react";
import { NEED_KEYS, NEED_META, type Needs } from "@/lib/needs";

type ProfileCategory = "profile" | "needs" | "goals" | "skills" | "settings";

type PlayerProfilePopupProps = {
  username: string;
  cash: number;
  needs: Needs;
  onClose: () => void;
};

const CATEGORIES: {
  id: ProfileCategory;
  label: string;
  icon: typeof UserRound;
}[] = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "needs", label: "Needs", icon: Heart },
  { id: "goals", label: "Goals", icon: Target },
  { id: "skills", label: "Skills", icon: Zap },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function PlayerProfilePopup({
  username,
  cash,
  needs,
  onClose,
}: PlayerProfilePopupProps) {
  const [category, setCategory] = useState<ProfileCategory>("profile");

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const formattedCash = `₦${cash.toLocaleString("en-NG")}`;

  return (
    <AnimatePresence>
      <motion.div
        key="player-profile-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="absolute inset-0 z-[60] flex items-center justify-center bg-[#11261f]/55 p-3 backdrop-blur-[3px] sm:p-5"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <motion.section
          role="dialog"
          aria-modal="true"
          aria-labelledby="player-profile-title"
          initial={{ opacity: 0, y: 18, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative flex max-h-[calc(100dvh-24px)] w-full max-w-[500px] flex-col overflow-hidden rounded-[10px] border border-white/80 bg-[#f9fbf6] shadow-[0_24px_80px_rgba(13,37,27,.4)]"
        >
          <header className="flex shrink-0 items-center justify-between border-b border-[#e4eae1] px-5 py-4 sm:px-6">
            <div className="min-w-0 pr-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#718276]">
                Osun Life · Player menu
              </p>
              <h2
                id="player-profile-title"
                className="mt-1 text-xl font-extrabold text-[#1b3329]"
              >
                Your journey
              </h2>
              <p className="mt-1 text-xs text-[#68776b]">
                Manage your character and life in Osogbo.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close player menu"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#68776b] transition-colors hover:bg-[#eaf0e8] hover:text-[#1b3329] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#26724f]"
            >
              <X size={19} />
            </button>
          </header>

          <nav
            aria-label="Player categories"
            className="grid shrink-0 grid-cols-5 gap-1 border-b border-[#e4eae1] bg-[#eef3eb] p-2"
          >
            {CATEGORIES.map(({ id, label, icon: Icon }) => {
              const active = category === id;

              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setCategory(id)}
                  className={`flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-md px-1 py-2.5 text-[10px] font-bold transition-colors sm:text-xs ${
                    active
                      ? "bg-white text-[#216342] shadow-sm"
                      : "text-[#748276] hover:bg-white/70 hover:text-[#28553c]"
                  }`}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {category === "profile" && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 rounded-lg border border-[#dce7d9] bg-white p-4">
                  <div className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-full border-[3px] border-white bg-[#20b978] text-4xl shadow-[0_4px_14px_rgba(20,60,43,.18)] ring-1 ring-[#20b978]">
                    👨‍🦱
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#819084]">
                      Player
                    </p>
                    <h3 className="mt-1 break-words text-lg font-extrabold text-[#1b3329]">
                      {username}
                    </h3>
                    <p className="mt-1 text-xs text-[#718276]">
                      Osogbo · Osun State
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-[#dce7d9] bg-white p-4">
                    <div className="flex items-center gap-2 text-[#718276]">
                      <Coins size={17} />
                      <span className="text-xs font-semibold">Available cash</span>
                    </div>
                    <p className="mt-2 break-words text-xl font-extrabold text-[#26724f]">
                      {formattedCash}
                    </p>
                  </div>

                  <div className="rounded-lg border border-[#dce7d9] bg-white p-4">
                    <div className="flex items-center gap-2 text-[#718276]">
                      <Heart size={17} />
                      <span className="text-xs font-semibold">Needs tracked</span>
                    </div>
                    <p className="mt-2 text-xl font-extrabold text-[#26724f]">
                      {NEED_KEYS.length}
                    </p>
                    <p className="mt-1 text-[10px] text-[#819084]">
                      Character needs
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-[#dce7d9] bg-[#eef7ed] p-4">
                  <div className="flex items-center gap-2">
                    <Sparkles size={18} className="text-[#26724f]" />
                    <h3 className="text-sm font-bold text-[#284b35]">
                      Your story is just beginning
                    </h3>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#68776b]">
                    Explore Osogbo, look after your character, earn money, and
                    build your life in Osun State.
                  </p>
                </div>
              </div>
            )}

            {category === "needs" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-extrabold text-[#1b3329]">
                    Character needs
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-[#718276]">
                    Keep your character&apos;s needs healthy as you play.
                  </p>
                </div>

                <div className="space-y-3">
                  {NEED_KEYS.map((key) => {
                    const { emoji, label } = NEED_META[key];
                    const value = needs[key];
                    const low = value < 25;

                    return (
                      <div
                        key={key}
                        className="rounded-lg border border-[#dce7d9] bg-white p-3.5"
                      >
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[#334a3c]">
                            <span className="text-lg">{emoji}</span>
                            <span>{label}</span>
                          </span>
                          <span
                            className={`shrink-0 text-sm font-extrabold ${
                              low ? "text-[#c65343]" : "text-[#26724f]"
                            }`}
                          >
                            {Math.round(value)}%
                          </span>
                        </div>

                        <div
                          className="h-2.5 overflow-hidden rounded-full bg-[#e6eee7]"
                          role="progressbar"
                          aria-label={label}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.round(value)}
                        >
                          <motion.div
                            className="h-full rounded-full"
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
            )}

            {category === "goals" && (
              <div className="flex min-h-[230px] flex-col items-center justify-center rounded-lg border border-dashed border-[#cbd9c8] bg-white px-5 py-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#eaf4e8] text-[#26724f]">
                  <Target size={27} />
                </div>
                <h3 className="mt-4 text-base font-extrabold text-[#1b3329]">
                  Your goals will appear here
                </h3>
                <p className="mt-2 max-w-[280px] text-xs leading-5 text-[#718276]">
                  Future missions, daily tasks, achievements, and progress will
                  live here as you build your life in Osun.
                </p>
                <span className="mt-4 rounded-full bg-[#eef3eb] px-3 py-1.5 text-[10px] font-bold text-[#627666]">
                  Goals system coming later
                </span>
              </div>
            )}

            {category === "skills" && (
              <div className="flex min-h-[230px] flex-col items-center justify-center rounded-lg border border-dashed border-[#cbd9c8] bg-white px-5 py-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#eaf4e8] text-[#26724f]">
                  <Zap size={27} />
                </div>
                <h3 className="mt-4 text-base font-extrabold text-[#1b3329]">
                  Develop your character
                </h3>
                <p className="mt-2 max-w-[280px] text-xs leading-5 text-[#718276]">
                  Skills, levels, experience points, and unlockable abilities
                  can be added here when your skill system is ready.
                </p>
                <span className="mt-4 rounded-full bg-[#eef3eb] px-3 py-1.5 text-[10px] font-bold text-[#627666]">
                  Skills system coming later
                </span>
              </div>
            )}

            {category === "settings" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-extrabold text-[#1b3329]">
                    Game settings
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-[#718276]">
                    Your game options can be managed here as settings are added.
                  </p>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-[#dce7d9] bg-white p-4">
                  <Settings
                    size={20}
                    className="mt-0.5 shrink-0 text-[#26724f]"
                  />
                  <div>
                    <h4 className="text-sm font-bold text-[#334a3c]">
                      Preferences
                    </h4>
                    <p className="mt-1 text-xs leading-5 text-[#718276]">
                      Sound, notifications, graphics, and gameplay preferences
                      can be added here later.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-[#dce7d9] bg-white p-4">
                  <LockKeyhole
                    size={20}
                    className="mt-0.5 shrink-0 text-[#26724f]"
                  />
                  <div>
                    <h4 className="text-sm font-bold text-[#334a3c]">
                      Account
                    </h4>
                    <p className="mt-1 text-xs leading-5 text-[#718276]">
                      Account management options can be connected here when
                      they are ready.
                    </p>
                  </div>
                </div>

                <p className="text-[10px] leading-4 text-[#819084]">
                  These are starter sections; no settings have been changed.
                </p>
              </div>
            )}
          </div>

          <footer className="shrink-0 border-t border-[#e4eae1] bg-white/80 px-5 py-3 sm:px-6">
            <p className="text-center text-[10px] font-medium text-[#819084]">
              OSUN LIFE · YOUR STORY, YOUR JOURNEY
            </p>
          </footer>
        </motion.section>
      </motion.div>
    </AnimatePresence>
  );
}