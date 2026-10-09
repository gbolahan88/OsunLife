"use client";

import { ArrowLeft } from "lucide-react";
import Apartment from "@/components/game/Apartment";

export default function HomeInterior({
  buildingName,
  onExit,
}: {
  buildingName: string;
  onExit: () => void;
}) {
  return (
    <>
      <div className="absolute inset-0 z-0" aria-label="Tobi's house interior">
        <Apartment />
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
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#728274]">Osogbo · Osun State</p>
            <h1 className="text-sm font-extrabold text-[#263d31]">{buildingName}</h1>
          </div>
        </div>
      </div>
    </>
  );
}