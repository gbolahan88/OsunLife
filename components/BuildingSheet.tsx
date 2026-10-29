// components/BuildingSheet.tsx
"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { formatNaira } from "@/lib/format";
import {
  BUILDING_INFO,
  FALLBACK_INFO,
  TRANSPORT_MODES,
  type TransportId,
} from "@/lib/buildingInfo";

type BuildingSheetProps = {
  buildingId: string;
  name: string;
  icon: string;
  /** Distance from the player to the building, in map units. */
  distance: number;
  cash: number;
  task?: { title: string; reward: number; ready: boolean };
  onClose: () => void;
  onGo: (mode: TransportId) => void;
};

export default function BuildingSheet({
  buildingId,
  name,
  icon,
  distance,
  cash,
  task,
  onClose,
  onGo,
}: BuildingSheetProps) {
  const info = BUILDING_INFO[buildingId] ?? FALLBACK_INFO;
  const [mode, setMode] = useState<TransportId>("trek");
  const [shown, setShown] = useState(false);

  // Slide up on mount
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Escape closes the sheet
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const selected = TRANSPORT_MODES.find((m) => m.id === mode) ?? TRANSPORT_MODES[0];
  const seconds = Math.max(2, Math.round(distance / selected.speed));
  const priceLabel = selected.price === 0 ? "Free" : formatNaira(selected.price);
  const canAfford = cash >= selected.price;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-center px-2 sm:px-4">
      <div
        role="dialog"
        aria-label={`${name} details`}
        className={`pointer-events-auto flex max-h-[68dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#141f2b]/95 pb-[env(safe-area-inset-bottom)] text-white shadow-[0_-12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md transition-transform duration-300 ease-out ${
          shown ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/25" />

        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 px-4 pb-3 pt-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-xl">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-extrabold leading-tight">{name}</h2>
            <p className="truncate text-xs font-medium text-white/60">{info.area}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrolling content */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
          <p className="text-[13px] leading-5 text-white/80">{info.blurb}</p>

          {info.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {info.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/85"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {task && (
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
              <span className="text-lg">🎯</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold">{task.title}</p>
                <p className="text-[11px] text-white/60">
                  {task.ready ? "Ready to do today" : "Available again tomorrow"}
                </p>
              </div>
              <span
                className={`shrink-0 text-xs font-extrabold tabular-nums ${
                  task.ready ? "text-[#4ade80]" : "text-white/40"
                }`}
              >
                +{formatNaira(task.reward)}
              </span>
            </div>
          )}

          <p className="mb-2 mt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">
            How do you want to get there?
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {TRANSPORT_MODES.map((m) => {
              const affordable = cash >= m.price;
              const active = m.id === mode;
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={!affordable}
                  onClick={() => setMode(m.id)}
                  aria-pressed={active}
                  className={`flex flex-col items-center gap-0.5 rounded-2xl border px-2 py-2.5 text-center transition-colors ${
                    active
                      ? "border-[#4da3ff] bg-[#1f3550]"
                      : "border-transparent bg-white/8 hover:bg-white/12"
                  } ${affordable ? "" : "cursor-not-allowed opacity-40"}`}
                >
                  <span className="text-xl">{m.emoji}</span>
                  <span className="text-[12px] font-bold">{m.name}</span>
                  <span className="text-[11px] text-white/60">
                    {m.price === 0 ? "Free" : formatNaira(m.price)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Go button */}
        <div className="shrink-0 px-4 pb-4 pt-2">
          <p className="mb-2 text-center text-[11px] text-white/50">
            About {seconds}s by {selected.name.toLowerCase()}
          </p>
          <button
            type="button"
            disabled={!canAfford}
            onClick={() => onGo(mode)}
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#17a05d] text-[15px] font-extrabold text-white shadow-lg transition-colors hover:bg-[#1bb468] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {canAfford ? `Go · ${priceLabel}` : "Not enough cash"}
          </button>
        </div>
      </div>
    </div>
  );
}