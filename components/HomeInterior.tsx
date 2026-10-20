"use client";

import { useState } from "react";
import { ArrowLeft, X, Trash2, RotateCw, Move } from "lucide-react";
import Apartment from "@/components/game/Apartment";
import BridgeShelter from "@/components/game/BridgeShelter";
import { getApartmentLayout } from "@/lib/apartmentConfig";
import { formatNaira } from "@/lib/format";
import { isHousingPlanId, type HousingStatus } from "@/lib/housing";
import { FURNITURE_BY_ID, type FurniturePosition, type PlacedFurniture } from "@/lib/furniture";
import { useGameStore } from "@/store/gameStore";
import { CharacterAppearance, DEFAULT_CHARACTER_APPEARANCE } from "@/store/characterAppearance";

type HomeInteriorProps = {
  buildingName: string;
  housing: HousingStatus;
  furniture: PlacedFurniture[];
  loan: number;
  cash: number;
  appearance?: CharacterAppearance;
  isNight?: boolean;
  onExit: () => void;
  onFindHome: () => void;
  onRepayLoan: () => void;
};

export default function HomeInterior({
  buildingName,
  housing,
  furniture,
  loan,
  cash,
  appearance = DEFAULT_CHARACTER_APPEARANCE,
  isNight = false,
  onExit,
  onFindHome,
  onRepayLoan,
}: HomeInteriorProps) {
  const [shelterInfoOpen, setShelterInfoOpen] = useState(false);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [placementNotice, setPlacementNotice] = useState<string | null>(null);

  const moveFurniture = useGameStore((state) => state.moveFurniture);
  const rotateFurniture = useGameStore((state) => state.rotateFurniture);
  const sellFurniture = useGameStore((state) => state.sellFurniture);

  const layout = isHousingPlanId(housing) ? getApartmentLayout(housing) : null;

  const selectedFurniture = furniture.find((item) => item.uid === selectedUid);
  const selectedDefinition = selectedFurniture ? FURNITURE_BY_ID[selectedFurniture.itemId] : undefined;

  const title = layout ? buildingName : "Under the Okefia Flyover";
  const subtitle = layout ? layout.name : "No home yet";

  function moveSelected(dx: number, dy: number) {
    if (!selectedFurniture) return;
    const position: FurniturePosition = {
      roomId: selectedFurniture.roomId,
      col: selectedFurniture.col + dx,
      row: selectedFurniture.row + dy,
      rotation: selectedFurniture.rotation,
    };
    const result = moveFurniture(selectedFurniture.uid, position);
    setPlacementNotice(result.ok ? "Moved." : result.reason ?? "Cannot move there.");
  }

  function rotateSelected() {
    if (!selectedFurniture) return;
    const result = rotateFurniture(selectedFurniture.uid);
    setPlacementNotice(result.ok ? "Rotated." : result.reason ?? "Cannot rotate here.");
  }

  function sellSelected() {
    if (!selectedFurniture) return;
    const result = sellFurniture(selectedFurniture.uid);
    setPlacementNotice(result.ok ? "Sold for 90% refund." : result.reason ?? "Cannot sell.");
    if (result.ok) setSelectedUid(null);
  }

  function closePopup() {
    setSelectedUid(null);
    setPlacementNotice(null);
  }

  return (
    <>
      <div
        className="absolute inset-0 z-0 overflow-hidden [&>canvas]:block [&>canvas]:h-full [&>canvas]:w-full [&>canvas]:touch-none"
        aria-label={layout ? `${layout.name} interior` : "Sleeping under the Okefia Flyover"}
      >
        {layout ? (
          <Apartment
            layout={layout}
            furniture={furniture}
            appearance={appearance}
            isNight={isNight}
            onSelectFurniture={(uid) => { setSelectedUid(uid); setPlacementNotice(null); }}
          />
        ) : (
          <BridgeShelter />
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="pointer-events-none absolute left-3 top-[calc(env(safe-area-inset-top)+7rem)] flex max-w-[calc(100%-1.5rem)] items-center gap-2 sm:left-4">
          <button
            type="button"
            onClick={onExit}
            aria-label="Return to map"
            title="Return to map"
            className="pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/90 bg-white/95 text-[#263d31] shadow-[0_6px_20px_rgba(24,50,39,0.2)] backdrop-blur transition-transform hover:scale-105"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="min-w-0 max-w-[calc(100vw-5rem)] rounded-md bg-white/40 px-3 py-2 shadow-[0_6px_20px_rgba(24,50,39,0.16)] backdrop-blur">
            <p className="truncate text-[9px] font-bold uppercase tracking-[0.12em] text-[#728274]">{subtitle}</p>
            <h1 className="truncate text-sm font-extrabold text-[#263d31]">{title}</h1>
          </div>
        </div>

        {!layout && (
          <div className="pointer-events-auto absolute left-3 top-[calc(env(safe-area-inset-top)+11.25rem)] w-[min(19rem,calc(100vw-1.5rem))] sm:left-4">
            <div className="overflow-hidden rounded-xl border border-white/25 bg-[#101c2b]/85 text-white shadow-[0_8px_24px_rgba(0,0,0,0.3)] backdrop-blur-md">
              <button
                type="button"
                onClick={() => setShelterInfoOpen((open) => !open)}
                className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
              >
                <span className="min-w-0 text-xs font-extrabold leading-5 sm:text-sm">You are sleeping under the bridge</span>
              </button>
              {shelterInfoOpen && (
                <div className="border-t border-white/15 px-3 pb-3 pt-2.5">
                  <p className="text-xs leading-5 text-white/75">Do tasks around the map to earn money, then rent a place of your own.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={onExit} className="rounded-full bg-[#20b978] px-3 py-2 text-[11px] font-bold text-white">Go to the map</button>
                    <button type="button" onClick={onFindHome} className="rounded-full border border-white/40 px-3 py-2 text-[11px] font-bold text-white">See homes to rent</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {layout && loan > 0 && (
          <div className="pointer-events-none absolute right-3 top-[calc(env(safe-area-inset-top)+7rem)] flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-full border border-white/90 bg-white/95 py-1.5 pl-3 pr-1.5 shadow-[0_6px_20px_rgba(24,50,39,0.16)] backdrop-blur sm:right-4">
            <span className="text-[10px] font-bold tabular-nums text-[#a14836] sm:text-[11px]">Loan owed {formatNaira(loan)}</span>
            <button type="button" onClick={onRepayLoan} disabled={cash <= 0} className="pointer-events-auto shrink-0 rounded-full bg-[#202838] px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50">Repay</button>
          </div>
        )}

        {/* ✅ Furniture popup - appears when a 3D item is clicked */}
        {selectedFurniture && selectedDefinition && (
          <div className="pointer-events-auto absolute left-1/2 bottom-32 z-30 w-[min(20rem,calc(100vw-1.5rem))] -translate-x-1/2 rounded-xl border border-white/90 bg-white/95 p-3 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="text-lg">{selectedDefinition.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-extrabold text-[#263d31]">{selectedDefinition.name}</p>
                <p className="text-[10px] text-[#728274]">Tile {selectedFurniture.col + 1}, {selectedFurniture.row + 1}</p>
              </div>
              <button type="button" onClick={closePopup} aria-label="Close" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#edf3ef]">
                <X size={14} />
              </button>
            </div>

            <div className="mt-2 grid grid-cols-4 gap-1.5">
              <button onClick={() => moveSelected(0, -1)} className="flex h-8 items-center justify-center rounded-lg bg-[#e9f5ed] text-base font-bold text-[#26724f]">↑</button>
              <button onClick={() => moveSelected(-1, 0)} className="flex h-8 items-center justify-center rounded-lg bg-[#e9f5ed] text-base font-bold text-[#26724f]">←</button>
              <button onClick={() => moveSelected(0, 1)} className="flex h-8 items-center justify-center rounded-lg bg-[#e9f5ed] text-base font-bold text-[#26724f]">↓</button>
              <button onClick={() => moveSelected(1, 0)} className="flex h-8 items-center justify-center rounded-lg bg-[#e9f5ed] text-base font-bold text-[#26724f]">→</button>
            </div>

            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              <button onClick={rotateSelected} className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[#263d31] text-[11px] font-bold text-white">
                <RotateCw size={12} /> Rotate
              </button>
              <button onClick={sellSelected} className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[#f0d2cd] bg-[#fff4f2] text-[11px] font-bold text-[#b44235]">
                <Trash2 size={12} /> Sell · {formatNaira(Math.floor(selectedDefinition.price * 0.9))}
              </button>
            </div>

            {placementNotice && (
              <p role="status" className="mt-2 rounded bg-[#f0f5f1] px-2 py-1.5 text-[10px] font-semibold text-[#355846]">{placementNotice}</p>
            )}
          </div>
        )}
      </div>
    </>
  );
}