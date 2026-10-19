"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Move,
  RotateCw,
  X,
} from "lucide-react";
import Apartment from "@/components/game/Apartment";
import BridgeShelter from "@/components/game/BridgeShelter";
import { getApartmentLayout } from "@/lib/apartmentConfig";
import { formatNaira } from "@/lib/format";
import { isHousingPlanId, type HousingStatus } from "@/lib/housing";
import {
  FURNITURE_BY_ID,
  type FurniturePosition,
  type PlacedFurniture,
} from "@/lib/furniture";
import { useGameStore } from "@/store/gameStore";
import {
  CharacterAppearance,
  DEFAULT_CHARACTER_APPEARANCE,
} from "@/store/characterAppearance";

type HomeInteriorProps = {
  buildingName: string;
  housing: HousingStatus;
  furniture: PlacedFurniture[];
  loan: number;
  cash: number;
  appearance?: CharacterAppearance;
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
  onExit,
  onFindHome,
  onRepayLoan,
}: HomeInteriorProps) {
  const [shelterInfoOpen, setShelterInfoOpen] = useState(false);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [placementNotice, setPlacementNotice] = useState<string | null>(null);
  const [furniturePanelOpen, setFurniturePanelOpen] = useState(false);

  const moveFurniture = useGameStore((state) => state.moveFurniture);
  const rotateFurniture = useGameStore((state) => state.rotateFurniture);

  const layout = isHousingPlanId(housing)
    ? getApartmentLayout(housing)
    : null;

  const selectedFurniture = furniture.find(
    (item) => item.uid === selectedUid,
  );

  const selectedDefinition = selectedFurniture
    ? FURNITURE_BY_ID[selectedFurniture.itemId]
    : undefined;

  const title = layout ? buildingName : "Under the Okefia Flyover";
  const subtitle = layout ? layout.name : "No home yet";

  function moveSelected(dx: number, dy: number) {
    if (!selectedFurniture) return;

    const position: FurniturePosition = {
      roomId: selectedFurniture.roomId,
      col: selectedFurniture.col + dx,
      row: selectedFurniture.row + dy,
      rotated: selectedFurniture.rotated,
    };

    const result = moveFurniture(selectedFurniture.uid, position);

    setPlacementNotice(
      result.ok
        ? "Furniture moved."
        : result.reason ?? "Cannot place furniture there.",
    );
  }

  function rotateSelected() {
    if (!selectedFurniture) return;

    const result = rotateFurniture(selectedFurniture.uid);

    setPlacementNotice(
      result.ok
        ? "Furniture rotation updated."
        : result.reason ?? "Cannot rotate furniture here.",
    );
  }

  function closeFurnitureControls() {
    setSelectedUid(null);
    setPlacementNotice(null);
  }

  return (
    <>
      <div
        className="absolute inset-0 z-0 overflow-hidden [&>canvas]:block [&>canvas]:h-full [&>canvas]:w-full [&>canvas]:touch-none"
        aria-label={
          layout
            ? `${layout.name} interior`
            : "Sleeping under the Okefia Flyover"
        }
      >
        {layout ? (
          <Apartment
            layout={layout}
            furniture={furniture}
            appearance={appearance}
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
            className="pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/90 bg-white/95 text-[#263d31] shadow-[0_6px_20px_rgba(24,50,39,0.2)] backdrop-blur transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#20b978]"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="min-w-0 max-w-[calc(100vw-5rem)] rounded-md  bg-white/40 px-3 py-2 shadow-[0_6px_20px_rgba(24,50,39,0.16)] backdrop-blur">
            <p className="truncate text-[9px] font-bold uppercase tracking-[0.12em] text-[#728274]">
              {subtitle}
            </p>
            <h1 className="truncate text-sm font-extrabold text-[#263d31]">
              {title}
            </h1>
          </div>
        </div>

        {!layout && (
          <div className="pointer-events-auto absolute left-3 top-[calc(env(safe-area-inset-top)+11.25rem)] w-[min(19rem,calc(100vw-1.5rem))] sm:left-4">
            <div className="overflow-hidden rounded-xl border border-white/25 bg-[#101c2b]/85 text-white shadow-[0_8px_24px_rgba(0,0,0,0.3)] backdrop-blur-md">
              <button
                type="button"
                onClick={() => setShelterInfoOpen((open) => !open)}
                aria-expanded={shelterInfoOpen}
                aria-controls="shelter-information"
                className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#20b978]"
              >
                <span className="min-w-0 text-xs font-extrabold leading-5 sm:text-sm">
                  You are sleeping under the bridge
                </span>

                {shelterInfoOpen ? (
                  <ChevronUp size={18} className="shrink-0 text-white/80" />
                ) : (
                  <ChevronDown size={18} className="shrink-0 text-white/80" />
                )}
              </button>

              {shelterInfoOpen && (
                <div
                  id="shelter-information"
                  className="border-t border-white/15 px-3 pb-3 pt-2.5"
                >
                  <p className="text-xs leading-5 text-white/75">
                    Do tasks around the map to earn money, then rent a place
                    of your own.
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={onExit}
                      className="rounded-full bg-[#20b978] px-3 py-2 text-[11px] font-bold text-white transition-colors hover:bg-[#159e65]"
                    >
                      Go to the map
                    </button>

                    <button
                      type="button"
                      onClick={onFindHome}
                      className="rounded-full border border-white/40 px-3 py-2 text-[11px] font-bold text-white transition-colors hover:bg-white/10"
                    >
                      See homes to rent
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {layout && loan > 0 && (
          <div className="pointer-events-none absolute right-3 top-[calc(env(safe-area-inset-top)+7rem)] flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-full border border-white/90 bg-white/95 py-1.5 pl-3 pr-1.5 shadow-[0_6px_20px_rgba(24,50,39,0.16)] backdrop-blur sm:right-4">
            <span className="text-[10px] font-bold tabular-nums text-[#a14836] sm:text-[11px]">
              Loan owed {formatNaira(loan)}
            </span>

            <button
              type="button"
              onClick={onRepayLoan}
              disabled={cash <= 0}
              className="pointer-events-auto shrink-0 rounded-full bg-[#202838] px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-[#2c3750] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Repay
            </button>
          </div>
        )}

        {layout && furniture.length > 0 && (
          <div className="pointer-events-auto absolute left-2 right-2 top-[calc(env(safe-area-inset-top)+10.5rem)] w-auto sm:left-4 sm:right-auto sm:top-[calc(env(safe-area-inset-top)+11.25rem)] sm:w-[min(23rem,calc(100vw-2rem))]">
            {!selectedFurniture ? (
              <div className="ml-auto w-fit max-w-full sm:ml-0 sm:w-50">
                <div className="overflow-hidden rounded-xl border border-white/80 bg-white/50 shadow-lg backdrop-blur-md">
                  <button
                    type="button"
                    onClick={() => setFurniturePanelOpen((open) => !open)}
                    aria-expanded={furniturePanelOpen}
                    aria-controls="furniture-arrangement-list"
                    className="flex min-h-10 items-center gap-2 px-3 py-2 text-left"
                  >
                    <Move size={15} className="shrink-0 text-[#21865a]" />
                    <span className="text-[11px] font-extrabold text-[#263d31] sm:text-xs">
                      Arrange furniture
                    </span>
                    {furniturePanelOpen ? (
                      <ChevronUp
                        size={15}
                        className="shrink-0 text-[#728274]"
                      />
                    ) : (
                      <ChevronDown
                        size={15}
                        className="shrink-0 text-[#728274]"
                      />
                    )}
                  </button>

                  {furniturePanelOpen && (
                    <div
                      id="furniture-arrangement-list"
                      className="max-w-[calc(100vw-1rem)] border-t border-[#e4ece6] p-2 sm:max-w-none"
                    >
                      <p className="px-1 text-[10px] text-[#728274]">
                        Choose an item to move or rotate it.
                      </p>

                      <div className="mt-2 flex max-h-28 gap-2 overflow-x-auto overscroll-contain pb-1">
                        {furniture.map((item) => {
                          const definition = FURNITURE_BY_ID[item.itemId];

                          if (!definition) return null;

                          return (
                            <button
                              key={item.uid}
                              type="button"
                              onClick={() => {
                                setSelectedUid(item.uid);
                                setPlacementNotice(null);
                                setFurniturePanelOpen(false);
                              }}
                              className="flex min-w-0 shrink-0 items-center gap-1.5 rounded-lg border border-[#dce7df] bg-white/50 px-2.5 py-2 text-left text-[#263d31] transition-colors hover:border-[#20b978]"
                            >
                              <span>{definition.emoji}</span>
                              <span className="max-w-24 truncate text-[10px] font-bold">
                                {definition.name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="ml-auto mt-55 max-h-[min(38vh,18rem)] w-[min(19rem,100%)] overflow-y-auto overscroll-contain rounded-xl border border-white/80 bg-white/40 p-2.5 shadow-lg backdrop-blur-md sm:ml-0 sm:w-full sm:p-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">
                    {selectedDefinition?.emoji ?? "🪑"}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-extrabold text-[#263d31]">
                      {selectedDefinition?.name ?? "Furniture"}
                    </p>
                    <p className="text-[10px] text-[#728274]">
                      Tile {selectedFurniture.col + 1},{" "}
                      {selectedFurniture.row + 1}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closeFurnitureControls}
                    aria-label="Close furniture controls"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#edf3ef] text-[#263d31]"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="mt-2 grid grid-cols-8 gap-1.5">
                  <button
                    type="button"
                    onClick={() => moveSelected(0, -1)}
                    aria-label="Move furniture up"
                    className="col-start-2 flex h-9 items-center justify-center rounded-lg bg-[#e9f5ed] text-lg font-extrabold text-[#26724f] hover:bg-[#d7eddf]"
                  >
                    ↑
                  </button>

                  <button
                    type="button"
                    onClick={() => moveSelected(-1, 0)}
                    aria-label="Move furniture left"
                    className="flex h-9 items-center justify-center rounded-lg bg-[#e9f5ed] text-lg font-extrabold text-[#26724f] hover:bg-[#d7eddf]"
                  >
                    ←
                  </button>

                  <button
                    type="button"
                    onClick={() => moveSelected(0, 1)}
                    aria-label="Move furniture down"
                    className="flex h-9 items-center justify-center rounded-lg bg-[#e9f5ed] text-lg font-extrabold text-[#26724f] hover:bg-[#d7eddf]"
                  >
                    ↓
                  </button>

                  <button
                    type="button"
                    onClick={() => moveSelected(1, 0)}
                    aria-label="Move furniture right"
                    className="flex h-9 items-center justify-center rounded-lg bg-[#e9f5ed] text-lg font-extrabold text-[#26724f] hover:bg-[#d7eddf]"
                  >
                    →
                  </button>

                  <button
                    type="button"
                    onClick={rotateSelected}
                    className="col-span-2 flex h-9 items-center justify-center gap-2 rounded-lg bg-[#263d31] text-xs font-bold text-white hover:bg-[#355846]"
                  >
                    <RotateCw size={15} />
                    Rotate
                  </button>
                </div>

                {placementNotice && (
                  <p
                    role="status"
                    className="mt-2 rounded-lg bg-[#f0f5f1] px-2.5 py-2 text-[11px] font-semibold text-[#355846]"
                  >
                    {placementNotice}
                  </p>
                )}

                <p className="mt-2 text-[10px] leading-4 text-[#728274]">
                  Changes save automatically. Invalid placements are rejected.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}