"use client";

import { useState } from "react";
import { Check, Home, ShoppingBag, X, Trash2 } from "lucide-react";
import { getApartmentLayout } from "@/lib/apartmentConfig";
import { formatNaira } from "@/lib/format";
import {
  FURNITURE_CATALOG,
  FURNITURE_CATEGORIES,
  findSpot,
  type FurnitureCategory,
  type PlacedFurniture,
} from "@/lib/furniture";
import { isHousingPlanId, type HousingStatus } from "@/lib/housing";
import type { ActionResult } from "@/store/gameStore";

type FurnitureShopProps = {
  cash: number;
  housing: HousingStatus;
  furniture: PlacedFurniture[];
  onBuy: (itemId: string) => ActionResult;
  onSell: (uid: string) => ActionResult;
  onFindHome: () => void;
  onClose: () => void;
};

export default function FurnitureShop({
  cash,
  housing,
  furniture,
  onBuy,
  onSell,
  onFindHome,
  onClose,
}: FurnitureShopProps) {
  const [category, setCategory] = useState<FurnitureCategory>("Sleep");
  const [feedback, setFeedback] = useState<string | null>(null);

  const layout = isHousingPlanId(housing)
    ? getApartmentLayout(housing)
    : null;

  const items = FURNITURE_CATALOG.filter(
    (item) => item.category === category,
  );

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-40 flex items-end justify-center bg-black/40 p-3 pb-24 pt-24 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <main
        role="dialog"
        aria-modal="true"
        aria-labelledby="furniture-shop-title"
        className="flex max-h-full min-h-0 w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/70 bg-[#f2f5ef]/95 shadow-[0_20px_70px_rgba(0,0,0,0.3)] backdrop-blur-xl sm:rounded-3xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#dce7d9] bg-white/80 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#dff1e4] text-[#26724f] sm:h-11 sm:w-11">
              <ShoppingBag size={21} />
            </span>

            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#718276] sm:text-[10px]">
                Osogbo home goods
              </p>
              <h1
                id="furniture-shop-title"
                className="text-base font-extrabold text-[#1b3329] sm:text-lg"
              >
                Furniture shop
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="rounded-full border border-[#dce7d9] bg-white px-2.5 py-2 text-[11px] font-extrabold tabular-nums text-[#26724f] sm:px-3 sm:text-xs">
              {formatNaira(cash)}
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close furniture shop"
              title="Close shop"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e0e8de] bg-white text-[#506258] transition-colors hover:bg-[#eaf2e8] hover:text-[#1b3329] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#26724f]"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 sm:py-4">
          {!layout ? (
            <section className="flex min-h-52 flex-col items-center justify-center py-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e5eee1] text-[#728274]">
                <Home size={25} />
              </span>

              <h2 className="mt-3 text-base font-extrabold text-[#1b3329]">
                Find a home first
              </h2>

              <p className="mt-1 max-w-xs text-sm text-[#68776b]">
                Your furniture needs a room to fit in.
              </p>

              <button
                type="button"
                onClick={onFindHome}
                className="mt-4 rounded-full bg-[#20b978] px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#159e65]"
              >
                See homes to rent
              </button>
            </section>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-[#dce7d9] bg-white/70 px-3 py-2.5">
                <span className="min-w-0 truncate text-xs font-semibold text-[#52675a]">
                  <Home size={14} className="mr-1.5 inline" />
                  {layout.name}
                </span>

                <span className="shrink-0 text-[10px] font-semibold text-[#718276] sm:text-xs">
                  {furniture.length} item
                  {furniture.length === 1 ? "" : "s"} placed
                </span>
              </div>

              <div
                className="mb-4 flex gap-2 overflow-x-auto pb-1"
                role="tablist"
                aria-label="Furniture categories"
              >
                {FURNITURE_CATEGORIES.map((entry) => (
                  <button
                    key={entry}
                    type="button"
                    role="tab"
                    aria-selected={category === entry}
                    onClick={() => {
                      setCategory(entry);
                      setFeedback(null);
                    }}
                    className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-bold transition-colors ${
                      category === entry
                        ? "border-[#26724f] bg-[#26724f] text-white"
                        : "border-[#d4dfd2] bg-white text-[#52675a] hover:bg-[#eaf2e8]"
                    }`}
                  >
                    {entry}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {items.map((item) => {
                  const spot = findSpot(layout, furniture, item);
                  const affordable = cash >= item.price;

                  const placedItems = furniture.filter(
                    (placed) => placed.itemId === item.id,
                  );

                  return (
                    <article
                      key={item.id}
                      className="flex min-w-0 items-center gap-3 rounded-xl border border-[#dce7d9] bg-white/90 p-3 transition-colors hover:border-[#b8d3bc]"
                    >
                      <span
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#edf3e9] text-2xl"
                        aria-hidden="true"
                      >
                        {item.emoji}
                      </span>

                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-sm font-extrabold text-[#1b3329]">
                          {item.name}
                        </h2>

                        <p className="mt-0.5 text-[10px] text-[#718276] sm:text-[11px]">
                          {item.w} × {item.d} tiles · {placedItems.length} placed
                        </p>

                        <p className="mt-1 text-xs font-extrabold tabular-nums text-[#26724f]">
                          {formatNaira(item.price)}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-col gap-1.5">
                        <button
                          type="button"
                          disabled={!spot || !affordable}
                          onClick={() => {
                            const result = onBuy(item.id);
                            setFeedback(
                              result.ok
                                ? `${item.name} placed in ${spot?.roomId}.`
                                : result.reason,
                            );
                          }}
                          className="flex min-h-9 items-center justify-center rounded-full bg-[#202838] px-3 text-[11px] font-bold text-white transition-colors hover:bg-[#34465b] disabled:cursor-not-allowed disabled:bg-[#d8e1d8] disabled:text-[#7a877d] sm:min-h-10 sm:px-3.5 sm:text-xs"
                        >
                          {spot && affordable
                            ? "Buy"
                            : !spot
                              ? "No space"
                              : "Too costly"}
                        </button>

                        {/* ✅ SELL BUTTON */}
                        {placedItems.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const target = placedItems[0];
                              const result = onSell(target.uid);
                              setFeedback(
                                result.ok
                                  ? `Sold ${item.name} for 90% refund.`
                                  : result.reason,
                              );
                            }}
                            className="flex min-h-8 items-center justify-center gap-1 rounded-full border border-[#f0d2cd] bg-[#fff4f2] px-3 text-[10px] font-bold text-[#b44235] transition-colors hover:bg-[#fde8e4]"
                            aria-label={`Sell one ${item.name}`}
                          >
                            <Trash2 size={11} />
                            Sell · {formatNaira(Math.floor(item.price * 0.9))}
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>

              {feedback && (
                <p
                  role="status"
                  className="mt-4 flex items-start gap-2 rounded-xl border border-[#cce5d1] bg-[#e8f5e9] p-3 text-xs font-semibold text-[#26724f]"
                >
                  <Check size={15} className="mt-0.5 shrink-0" />
                  <span>{feedback}</span>
                </p>
              )}
            </>
          )}
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-[#dce7d9] bg-white/80 px-4 py-3 sm:px-5">
          <p className="text-[10px] text-[#718276] sm:text-xs">
            Make your home feel like yours.
          </p>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full border border-[#d4dfd2] bg-white px-4 py-2 text-xs font-bold text-[#52675a] transition-colors hover:bg-[#eaf2e8]"
          >
            Done
          </button>
        </footer>
      </main>
    </div>
  );
}