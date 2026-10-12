"use client";

import { ArrowLeft } from "lucide-react";
import Apartment from "@/components/game/Apartment";
import BridgeShelter from "@/components/game/BridgeShelter";
import { getApartmentLayout } from "@/lib/apartmentConfig";
import { formatNaira } from "@/lib/format";
import { isHousingPlanId, type HousingStatus } from "@/lib/housing";
import type { PlacedFurniture } from "@/lib/furniture";

type HomeInteriorProps = {
  buildingName: string;
  housing: HousingStatus;
  furniture: PlacedFurniture[];
  loan: number;
  cash: number;
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
  onExit,
  onFindHome,
  onRepayLoan,
}: HomeInteriorProps) {
  const layout = isHousingPlanId(housing) ? getApartmentLayout(housing) : null;
  const title = layout ? buildingName : "Under the Okefia Flyover";
  const subtitle = layout ? layout.name : "No home yet";

  return (
    <>
      <div
        className="absolute inset-0 z-0"
        aria-label={layout ? `${layout.name} interior` : "Sleeping under the Okefia Flyover"}
      >
        {layout ? <Apartment layout={layout} furniture={furniture} /> : <BridgeShelter />}
      </div>

      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="pointer-events-auto absolute left-4 top-28 flex items-center gap-2.5">
          <button
            type="button"
            onClick={onExit}
            aria-label="Return to map"
            title="Return to map"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/90 bg-white/95 text-[#263d31] shadow-[0_6px_20px_rgba(24,50,39,0.2)] backdrop-blur transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#20b978]"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="rounded-md border border-white/90 bg-white/95 px-3 py-2 shadow-[0_6px_20px_rgba(24,50,39,0.16)] backdrop-blur">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#728274]">{subtitle}</p>
            <h1 className="text-sm font-extrabold text-[#263d31]">{title}</h1>
          </div>
        </div>

        {layout && loan > 0 && (
          <div className="pointer-events-auto absolute right-4 top-28 flex items-center gap-2 rounded-full border border-white/90 bg-white/95 py-1.5 pl-3 pr-1.5 shadow-[0_6px_20px_rgba(24,50,39,0.16)] backdrop-blur">
            <span className="text-[11px] font-bold tabular-nums text-[#a14836]">
              Loan owed {formatNaira(loan)}
            </span>
            <button
              type="button"
              onClick={onRepayLoan}
              disabled={cash <= 0}
              className="rounded-full bg-[#202838] px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-[#2c3750] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Repay
            </button>
          </div>
        )}

        {!layout && (
          <div className="pointer-events-auto absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+96px)] px-3">
            <div className="mx-auto my-40 max-w-[460px] rounded-xl border border-white/20 bg-[#101c2b]/85 p-4 text-center text-white shadow-[0_10px_32px_rgba(0,0,0,0.4)] backdrop-blur-md">
              <p className="text-sm font-extrabold">You are sleeping under the bridge</p>
              <p className="mt-1 text-xs leading-5 text-white/75">
                Do tasks around the map to earn money, then rent a place of your own.
              </p>
              <div className="mt-3 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={onExit}
                  className="rounded-full bg-[#20b978] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#159e65]"
                >
                  Go to the map
                </button>
                <button
                  type="button"
                  onClick={onFindHome}
                  className="rounded-full border border-white/40 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-white/10"
                >
                  See homes to rent
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}