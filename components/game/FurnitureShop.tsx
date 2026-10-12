"use client";

import { useState } from "react";
import { Check, Home, ShoppingBag } from "lucide-react";
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
  onFindHome: () => void;
};

export default function FurnitureShop({
  cash,
  housing,
  furniture,
  onBuy,
  onFindHome,
}: FurnitureShopProps) {
  const [category, setCategory] = useState<FurnitureCategory>("Sleep");
  const [feedback, setFeedback] = useState<string | null>(null);
  const layout = isHousingPlanId(housing) ? getApartmentLayout(housing) : null;
  const items = FURNITURE_CATALOG.filter((item) => item.category === category);

  return (
    <main className="absolute inset-0 z-10 flex flex-col bg-[#f2f5ef]">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-28 pt-24 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <header className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#dff1e4] text-[#26724f]">
                <ShoppingBag size={21} />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#718276]">Osogbo home goods</p>
                <h1 className="text-lg font-extrabold text-[#1b3329]">Buy furniture</h1>
              </div>
            </div>
            <div className="rounded-full border border-[#dce7d9] bg-white px-3 py-2 text-xs font-extrabold tabular-nums text-[#26724f]">
              {formatNaira(cash)}
            </div>
          </header>

          {!layout ? (
            <section className="border-y border-[#dce7d9] py-8 text-center">
              <Home size={26} className="mx-auto text-[#728274]" />
              <h2 className="mt-3 text-base font-extrabold text-[#1b3329]">Find a home first</h2>
              <p className="mt-1 text-sm text-[#68776b]">Your furniture needs a room to fit in.</p>
              <button
                type="button"
                onClick={onFindHome}
                className="mt-4 rounded-full bg-[#20b978] px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#159e65]"
              >
                See homes to rent
              </button>
            </section>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between gap-3 border-y border-[#dce7d9] py-3">
                <span className="min-w-0 truncate text-xs font-semibold text-[#52675a]">
                  <Home size={14} className="mr-1.5 inline" />{layout.name}
                </span>
                <span className="shrink-0 text-xs font-semibold text-[#718276]">
                  {furniture.length} item{furniture.length === 1 ? "" : "s"} placed
                </span>
              </div>

              <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Furniture categories">
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
                    className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold transition-colors ${category === entry ? "border-[#26724f] bg-[#26724f] text-white" : "border-[#d4dfd2] bg-white text-[#52675a] hover:bg-[#eaf2e8]"}`}
                  >
                    {entry}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {items.map((item) => {
                  const spot = findSpot(layout, furniture, item);
                  const affordable = cash >= item.price;
                  const placedCount = furniture.filter((placed) => placed.itemId === item.id).length;

                  return (
                    <article key={item.id} className="flex min-w-0 items-center gap-3 border-b border-[#dce7d9] bg-white/70 p-3 sm:rounded-lg sm:border sm:bg-white">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#edf3e9] text-2xl" aria-hidden="true">
                        {item.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-sm font-extrabold text-[#1b3329]">{item.name}</h2>
                        <p className="mt-0.5 text-[11px] text-[#718276]">{item.w} × {item.d} tiles · {placedCount} placed</p>
                        <p className="mt-1 text-xs font-extrabold tabular-nums text-[#26724f]">{formatNaira(item.price)}</p>
                      </div>
                      <button
                        type="button"
                        disabled={!spot || !affordable}
                        onClick={() => {
                          const result = onBuy(item.id);
                          setFeedback(result.ok ? `${item.name} placed in ${spot?.roomId}.` : result.reason);
                        }}
                        className="flex min-h-10 shrink-0 items-center gap-1 rounded-full bg-[#202838] px-3 text-xs font-bold text-white transition-colors hover:bg-[#34465b] disabled:cursor-not-allowed disabled:bg-[#d8e1d8] disabled:text-[#7a877d]"
                      >
                        {spot && affordable ? "Buy" : !spot ? "No space" : "Too costly"}
                      </button>
                    </article>
                  );
                })}
              </div>

              {feedback && (
                <p role="status" className="mt-4 flex items-center gap-2 text-xs font-semibold text-[#26724f]">
                  <Check size={15} />{feedback}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}