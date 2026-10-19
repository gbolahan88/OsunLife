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
  LogOut,
} from "lucide-react";
import { NEED_KEYS, NEED_META, type Needs } from "@/lib/needs";
import { signOut } from "@/app/auth-actions";
import {
  CharacterAppearance,
  DEFAULT_CHARACTER_APPEARANCE,
  GENDERS,
  HAIRSTYLES,
  OUTFITS,
  FABRICS,
  SKIN_TONES,
  HAIR_COLORS,
  SHIRT_COLORS,
  TROUSER_COLORS,
} from "@/store/characterAppearance";
import CharacterPreview3D from "@/components/game/CharacterPreview3D";

/* ------------------------------------------------------------------ */
/*  Small reusable UI pieces (declared OUTSIDE the popup component)    */
/* ------------------------------------------------------------------ */

function OptionPills({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mb-4">
      <p className="mb-2 text-[11px] font-bold text-[#3a4a3d]">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${
              value === opt
                ? "bg-[#1b3329] text-white"
                : "bg-[#e8ede5] text-[#4a5c50] hover:bg-[#d7ded4]"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function ColorSwatches({
  label,
  colors,
  value,
  onChange,
}: {
  label: string;
  colors: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mb-4">
      <p className="mb-2 text-[11px] font-bold text-[#3a4a3d]">{label}</p>
      <div className="flex flex-wrap gap-2">
        {colors.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(c.value)}
            title={c.label}
            aria-label={c.label}
            className={`h-7 w-7 rounded-full transition-transform ${
              value === c.value
                ? "ring-2 ring-[#1b3329] ring-offset-2 scale-110"
                : "ring-1 ring-black/10 hover:scale-105"
            }`}
            style={{ backgroundColor: c.value }}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main popup                                                         */
/* ------------------------------------------------------------------ */

type ProfileCategory = "profile" | "needs" | "goals" | "skills" | "settings";

type PlayerProfilePopupProps = {
  username: string;
  cash: number;
  needs: Needs;
  appearance?: CharacterAppearance;
  onUpdateAppearance?: (key: keyof CharacterAppearance, value: string) => void;
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
  appearance: appearanceProp,
  onUpdateAppearance: onUpdateProp,
  onClose,
}: PlayerProfilePopupProps) {
  const [category, setCategory] = useState<ProfileCategory>("profile");

  const appearance: CharacterAppearance =
    appearanceProp ?? DEFAULT_CHARACTER_APPEARANCE;
  const onUpdateAppearance =
    onUpdateProp ??
    ((key, value) => {
      console.warn(
        "[PlayerProfilePopup] onUpdateAppearance missing — cannot update",
        key,
        value
      );
    });

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
          className="relative flex max-h-[calc(100dvh-24px)] w-full max-w-[520px] flex-col overflow-hidden rounded-[10px] border border-white/80 bg-[#f9fbf6] shadow-[0_24px_80px_rgba(13,37,27,.4)]"
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
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close player menu"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#68776b] transition-colors hover:bg-[#eaf0e8] hover:text-[#1b3329]"
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
                  onClick={() => setCategory(id)}
                  className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 py-2 text-[10px] font-bold transition-colors ${
                    active
                      ? "bg-white text-[#216342] shadow-sm"
                      : "text-[#748276] hover:bg-white/70 hover:text-[#28553c]"
                  }`}
                >
                  <Icon size={17} />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {category === "profile" && (
              <div className="p-4 sm:p-6">
                {/* Live 3D character preview */}
                <div className="mx-auto mb-4 w-full max-w-[340px]">
                  <CharacterPreview3D appearance={appearance} height={300} />
                </div>

                {/* Player card */}
                <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-[#dce7d9] bg-white px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#819084]">
                      Player
                    </p>
                    <h3 className="mt-0.5 truncate text-base font-extrabold text-[#1b3329]">
                      {username}
                    </h3>
                    <p className="text-[11px] text-[#718276]">
                      Osogbo · Osun State
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#819084]">
                      Cash
                    </p>
                    <p className="mt-0.5 text-base font-extrabold text-[#26724f]">
                      {formattedCash}
                    </p>
                  </div>
                </div>

                {/* Customization controls */}
                <OptionPills
                  label="Body"
                  options={GENDERS}
                  value={appearance.gender}
                  onChange={(v) => onUpdateAppearance("gender", v)}
                />
                <OptionPills
                  label="Hairstyle"
                  options={HAIRSTYLES}
                  value={appearance.hairstyle}
                  onChange={(v) => onUpdateAppearance("hairstyle", v)}
                />
                <OptionPills
                  label="Outfit"
                  options={OUTFITS}
                  value={appearance.outfit}
                  onChange={(v) => onUpdateAppearance("outfit", v)}
                />
                <OptionPills
                  label="Fabric"
                  options={FABRICS}
                  value={appearance.fabric}
                  onChange={(v) => onUpdateAppearance("fabric", v)}
                />

                <ColorSwatches
                  label="Skin tone"
                  colors={SKIN_TONES}
                  value={appearance.skin}
                  onChange={(v) => onUpdateAppearance("skin", v)}
                />
                <ColorSwatches
                  label="Hair colour"
                  colors={HAIR_COLORS}
                  value={appearance.hair}
                  onChange={(v) => onUpdateAppearance("hair", v)}
                />
                <ColorSwatches
                  label="Outfit colour"
                  colors={SHIRT_COLORS}
                  value={appearance.shirt}
                  onChange={(v) => onUpdateAppearance("shirt", v)}
                />
                <ColorSwatches
                  label="Bottoms"
                  colors={TROUSER_COLORS}
                  value={appearance.trousers}
                  onChange={(v) => onUpdateAppearance("trousers", v)}
                />

                <div className="mt-4 rounded-lg border border-[#dce7d9] bg-[#eef7ed] p-3">
                  <div className="flex items-center gap-2">
                    <Sparkles size={15} className="text-[#26724f]" />
                    <p className="text-xs font-bold text-[#284b35]">
                      Your look updates live on the map
                    </p>
                  </div>
                </div>
              </div>
            )}

            {category === "needs" && (
              <div className="space-y-4 p-4 sm:p-6">
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
                        <div className="h-2.5 overflow-hidden rounded-full bg-[#e6eee7]">
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
              <div className="flex min-h-[230px] flex-col items-center justify-center p-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#eaf4e8] text-[#26724f]">
                  <Target size={27} />
                </div>
                <h3 className="mt-4 text-base font-extrabold text-[#1b3329]">
                  Your goals will appear here
                </h3>
                <p className="mt-2 max-w-[280px] text-xs leading-5 text-[#718276]">
                  Future missions, daily tasks, and achievements will live here.
                </p>
              </div>
            )}

            {category === "skills" && (
              <div className="flex min-h-[230px] flex-col items-center justify-center p-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#eaf4e8] text-[#26724f]">
                  <Zap size={27} />
                </div>
                <h3 className="mt-4 text-base font-extrabold text-[#1b3329]">
                  Develop your character
                </h3>
                <p className="mt-2 max-w-[280px] text-xs leading-5 text-[#718276]">
                  Skills and abilities will appear here.
                </p>
              </div>
            )}

            {category === "settings" && (
              <div className="space-y-4 p-4 sm:p-6">
                <div className="flex items-start gap-3 rounded-lg border border-[#dce7d9] bg-white p-4">
                  <LockKeyhole
                    size={20}
                    className="mt-0.5 shrink-0 text-[#26724f]"
                  />
                  <div>
                    <h4 className="text-sm font-bold text-[#334a3c]">Account</h4>
                    <p className="mt-1 text-xs leading-5 text-[#718276]">
                      Signed in as{" "}
                      <span className="font-semibold text-[#334a3c]">
                        {username}
                      </span>
                    </p>
                  </div>
                </div>

                <form action={signOut}>
                  <button
                    type="submit"
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-[#f0d2cd] bg-[#fff4f2] px-4 py-3 text-sm font-bold text-[#b44235] transition-colors hover:bg-[#fde8e4]"
                  >
                    <LogOut size={18} />
                    Sign out
                  </button>
                </form>
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