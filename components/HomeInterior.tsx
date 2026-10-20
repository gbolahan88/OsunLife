"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft, ShoppingBag, X, RotateCw, ArrowUp, ArrowDown,
  ArrowLeft as ArrowLeftIcon, ArrowRight, Check,
} from "lucide-react";
import Apartment from "@/components/game/Apartment";
import BridgeShelter from "@/components/game/BridgeShelter";
import { getApartmentLayout } from "@/lib/apartmentConfig";
import { formatNaira } from "@/lib/format";
import { isHousingPlanId, type HousingStatus } from "@/lib/housing";
import {
  FURNITURE_BY_ID, FURNITURE_CATALOG, FURNITURE_CATEGORIES,
  validateFurniturePlacement,
  type FurniturePosition, type PlacedFurniture, type FurnitureCategory,
} from "@/lib/furniture";
import { useGameStore, FURNITURE_INTERACTIONS } from "@/store/gameStore";
import { CharacterAppearance, DEFAULT_CHARACTER_APPEARANCE } from "@/store/characterAppearance";
import { NEED_META, type NeedKey } from "@/lib/needs";

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
  onEditingChange?: (editing: boolean) => void;
};

export default function HomeInterior({
  buildingName, housing, furniture, loan, cash,
  appearance = DEFAULT_CHARACTER_APPEARANCE, isNight = false,
  onExit, onFindHome, onRepayLoan, onEditingChange,
}: HomeInteriorProps) {
  const [buyMode, setBuyMode] = useState(false);
  const [activeCategory, setActiveCategory] = useState<FurnitureCategory>("Sleep");
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [placementNotice, setPlacementNotice] = useState<string | null>(null);
  const [interactionUid, setInteractionUid] = useState<string | null>(null);
  const [shelterInfoOpen, setShelterInfoOpen] = useState(false);

  const moveFurniture = useGameStore((s) => s.moveFurniture);
  const rotateFurniture = useGameStore((s) => s.rotateFurniture);
  const sellFurniture = useGameStore((s) => s.sellFurniture);
  const buyFurniture = useGameStore((s) => s.buyFurniture);
  // Aliased to avoid ESLint treating it as a React hook
  const applyFurniture = useGameStore((s) => s.useFurniture);

  const layout = isHousingPlanId(housing) ? getApartmentLayout(housing) : null;

  const selectedFurniture = furniture.find((item) => item.uid === selectedUid);
  const selectedDefinition = selectedFurniture ? FURNITURE_BY_ID[selectedFurniture.itemId] : undefined;

  const interactionFurniture = furniture.find((item) => item.uid === interactionUid);
  const interactionDefinition = interactionFurniture ? FURNITURE_BY_ID[interactionFurniture.itemId] : undefined;
  const interactionActions = interactionFurniture ? FURNITURE_INTERACTIONS[interactionFurniture.itemId] ?? [] : [];

  const isValid = (() => {
    if (!selectedFurniture || !selectedDefinition || !layout) return true;
    const result = validateFurniturePlacement(
      layout, furniture, selectedDefinition,
      {
        roomId: selectedFurniture.roomId,
        col: selectedFurniture.col,
        row: selectedFurniture.row,
        rotation: selectedFurniture.rotation,
      },
      selectedFurniture.uid,
    );
    return result.ok;
  })();

  // ✅ Deferred + change-guarded edit-mode notifier.
  // This prevents "unmount during render" / removeChild errors.
  const wasEditingRef = useRef<boolean | null>(null);
  useEffect(() => {
    const nowEditing = buyMode || !!selectedUid;
    if (wasEditingRef.current === nowEditing) return;
    wasEditingRef.current = nowEditing;
    queueMicrotask(() => {
      onEditingChange?.(nowEditing);
    });
  }, [buyMode, selectedUid, onEditingChange]);

  const title = layout ? buildingName : "Under the Okefia Flyover";
  const subtitle = layout ? layout.name : "No home yet";

  function closeBuyMode() {
    setBuyMode(false);
    setSelectedUid(null);
    setPlacementNotice(null);
  }

  function moveSelected(dx: number, dy: number) {
    if (!selectedFurniture) return;
    const position: FurniturePosition = {
      roomId: selectedFurniture.roomId,
      col: selectedFurniture.col + dx,
      row: selectedFurniture.row + dy,
      rotation: selectedFurniture.rotation,
    };
    const result = moveFurniture(selectedFurniture.uid, position);
    setPlacementNotice(result.ok ? null : result.reason ?? "Cannot move there.");
  }

  function rotateSelected() {
    if (!selectedFurniture) return;
    const result = rotateFurniture(selectedFurniture.uid);
    setPlacementNotice(result.ok ? null : result.reason ?? "Cannot rotate here.");
  }

  function sellSelected() {
    if (!selectedFurniture) return;
    sellFurniture(selectedFurniture.uid);
    setSelectedUid(null);
  }

  function buyFromCatalog(itemId: string) {
    const result = buyFurniture(itemId);
    setPlacementNotice(result.ok ? null : result.reason ?? "Cannot place.");
  }

  function performInteraction(need: NeedKey, amount: number) {
    if (!interactionUid) return;
    const result = applyFurniture(interactionUid, need, amount);
    setPlacementNotice(result.ok ? null : result.reason ?? "Cannot use this.");
    if (result.ok) setInteractionUid(null);
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
            onSelectFurniture={(uid) => {
              if (buyMode) { setSelectedUid(uid); setPlacementNotice(null); }
              else { setInteractionUid(uid); setPlacementNotice(null); }
            }}
            onExitToMap={onExit}
            movingUid={buyMode ? selectedUid : null}
            editingMode={buyMode || !!selectedUid}
            movingIsValid={isValid}
          />
        ) : (
          <BridgeShelter />
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 z-10">
        {!buyMode && !selectedUid && (
          <div className="pointer-events-none absolute left-3 top-[calc(env(safe-area-inset-top)+7rem)] flex max-w-[calc(100%-1.5rem)] items-center gap-2 sm:left-4">
            <button
              type="button"
              onClick={onExit}
              className="pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/90 bg-white/95 text-[#263d31] shadow-lg backdrop-blur"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0 max-w-[calc(100vw-5rem)] rounded-md bg-white/40 px-3 py-2 shadow-lg backdrop-blur">
              <p className="truncate text-[9px] font-bold uppercase tracking-[0.12em] text-[#728274]">{subtitle}</p>
              <h1 className="truncate text-sm font-extrabold text-[#263d31]">{title}</h1>
            </div>
          </div>
        )}

        {!selectedUid && (
          <button
            type="button"
            onClick={() => buyMode ? closeBuyMode() : setBuyMode(true)}
            className="pointer-events-auto absolute right-3 top-[calc(env(safe-area-inset-top)+7rem)] flex h-10 items-center gap-2 rounded-full border border-white/90 bg-white/95 px-3 text-[11px] font-bold text-[#263d31] shadow-lg backdrop-blur sm:right-4"
          >
            <ShoppingBag size={14} />
            {buyMode ? "Exit Buy Mode" : "Buy mode"}
          </button>
        )}

        {!layout && (
          <div className="pointer-events-auto absolute left-3 top-[calc(env(safe-area-inset-top)+11.25rem)] w-[min(19rem,calc(100vw-1.5rem))] sm:left-4">
            <div className="overflow-hidden rounded-xl border border-white/25 bg-[#101c2b]/85 text-white shadow-lg backdrop-blur-md">
              <button type="button" onClick={() => setShelterInfoOpen((open) => !open)} className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2.5 text-left">
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

        {layout && loan > 0 && !selectedUid && !buyMode && (
          <div className="pointer-events-none absolute right-3 top-[calc(env(safe-area-inset-top)+11rem)] flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-full border border-white/90 bg-white/95 py-1.5 pl-3 pr-1.5 shadow-lg backdrop-blur sm:right-4">
            <span className="text-[10px] font-bold tabular-nums text-[#a14836] sm:text-[11px]">Loan owed {formatNaira(loan)}</span>
            <button type="button" onClick={onRepayLoan} disabled={cash <= 0} className="pointer-events-auto shrink-0 rounded-full bg-[#202838] px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50">Repay</button>
          </div>
        )}

        {buyMode && (
          <>
            <div className="pointer-events-auto absolute inset-x-0 bottom-24 z-30 flex justify-center px-3">
              <div className="w-[min(30rem,calc(100vw-1.5rem))] rounded-3xl bg-white p-3 shadow-2xl">
                <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
                  {FURNITURE_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveCategory(cat)}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${
                        activeCategory === cat
                          ? "bg-[#263d31] text-white"
                          : "bg-[#eef3eb] text-[#4a5c50] hover:bg-[#dce7d9]"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <div className="flex max-h-40 gap-2 overflow-x-auto pb-1">
                  {FURNITURE_CATALOG.filter((f) => f.category === activeCategory).map((item) => {
                    const affordable = cash >= item.price;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={!affordable}
                        onClick={() => buyFromCatalog(item.id)}
                        className={`flex w-32 shrink-0 flex-col items-start gap-1 rounded-xl border border-[#dce7d9] bg-white p-2 text-left transition-colors ${
                          affordable ? "hover:border-[#20b978]" : "opacity-50"
                        }`}
                      >
                        <span className="text-lg">{item.emoji}</span>
                        <span className="truncate text-[10px] font-extrabold text-[#1b3329]">{item.name}</span>
                        <span className="text-[10px] font-bold text-[#26724f]">{formatNaira(item.price)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {selectedFurniture && selectedDefinition && (
              <div className="pointer-events-auto absolute inset-x-0 bottom-2 z-40 flex justify-center px-3">
                <div className="w-[min(26rem,calc(100vw-1.5rem))] rounded-3xl bg-white p-4 shadow-2xl">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-extrabold text-[#1b3329]">{selectedDefinition.name}</h2>
                      <p className={`text-[11px] ${isValid ? "text-[#718276]" : "text-[#b44235]"}`}>
                        {isValid ? "Valid position" : "Cannot place here"}
                      </p>
                    </div>
                    <button type="button" onClick={() => setSelectedUid(null)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#edf3ef]">
                      <X size={14} />
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
                      <button onClick={() => moveSelected(0, -1)} className="absolute left-1/2 top-0 -translate-x-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-[#e9f5ed] text-[#26724f]"><ArrowUp size={12} /></button>
                      <button onClick={() => moveSelected(-1, 0)} className="absolute left-0 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-[#e9f5ed] text-[#26724f]"><ArrowLeftIcon size={12} /></button>
                      <button onClick={() => moveSelected(1, 0)} className="absolute right-0 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-[#e9f5ed] text-[#26724f]"><ArrowRight size={12} /></button>
                      <button onClick={() => moveSelected(0, 1)} className="absolute bottom-0 left-1/2 -translate-x-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-[#e9f5ed] text-[#26724f]"><ArrowDown size={12} /></button>
                      <button onClick={rotateSelected} className="flex h-11 w-11 items-center justify-center rounded-full bg-[#263d31] text-white"><RotateCw size={15} /></button>
                    </div>

                    <div className="flex flex-1 flex-col gap-1.5">
                      <button onClick={() => setSelectedUid(null)} className="flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#20b978] text-[12px] font-extrabold text-white">
                        <Check size={14} /> Place
                      </button>
                      <button onClick={sellSelected} className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#f0d2cd] bg-[#fff4f2] text-[12px] font-extrabold text-[#b44235]">
                        <X size={14} /> Sell · {formatNaira(Math.floor(selectedDefinition.price * 0.9))}
                      </button>
                    </div>
                  </div>

                  {placementNotice && (
                    <p role="status" className="mt-2 rounded-lg bg-[#f0f5f1] px-2.5 py-1.5 text-[10px] font-semibold text-[#355846]">{placementNotice}</p>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {!buyMode && interactionFurniture && interactionDefinition && (
          <div className="pointer-events-auto absolute inset-x-0 bottom-32 z-40 flex justify-center px-3">
            <div className="w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl bg-white p-3 shadow-2xl">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-lg">{interactionDefinition.emoji}</span>
                <h2 className="flex-1 truncate text-sm font-extrabold text-[#1b3329]">{interactionDefinition.name}</h2>
                <button type="button" onClick={() => setInteractionUid(null)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#edf3ef]">
                  <X size={14} />
                </button>
              </div>
              {interactionActions.length === 0 ? (
                <p className="py-2 text-center text-[11px] text-[#718276]">Nothing to do with this.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {interactionActions.map((action, i) => (
                    <button
                      key={i}
                      onClick={() => performInteraction(action.need, action.amount)}
                      className="flex min-h-10 items-center justify-between rounded-xl bg-[#eef3eb] px-3 text-[12px] font-bold text-[#1b3329] transition-colors hover:bg-[#dce7d9]"
                    >
                      <span className="flex items-center gap-2">
                        <span>{action.emoji}</span>
                        {action.label}
                      </span>
                      <span className="text-[10px] font-semibold text-[#52675a]">
                        +{action.amount} {NEED_META[action.need].emoji}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {placementNotice && (
                <p role="status" className="mt-2 rounded-lg bg-[#f0f5f1] px-2.5 py-1.5 text-[10px] font-semibold text-[#355846]">{placementNotice}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}