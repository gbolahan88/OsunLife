"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, Coins, Landmark, X } from "lucide-react";
import { formatNaira } from "@/lib/format";
import { HOUSING_PLANS, LOAN_OFFER, type HousingPlanId } from "@/lib/housing";
import type { ActionResult } from "@/store/gameStore";

type RentPopupProps = {
  cash: number;
  loanTaken: boolean;
  // When true the player can close the pop-up (they already chose "sleep rough" before).
  canClose: boolean;
  onRent: (planId: HousingPlanId, takeLoan: boolean) => ActionResult;
  onSleepRough: () => void;
  onClose: () => void;
};

export default function RentPopup({
  cash,
  loanTaken,
  canClose,
  onRent,
  onSleepRough,
  onClose,
}: RentPopupProps) {
  const [takeLoan, setTakeLoan] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canClose) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [canClose, onClose]);

  const loanActive = takeLoan && !loanTaken;
  const available = cash + (loanActive ? LOAN_OFFER : 0);

  function rent(planId: HousingPlanId) {
    const result = onRent(planId, loanActive);
    if (!result.ok) setError(result.reason);
  }

  return (
    <AnimatePresence>
      <motion.div
        key="rent-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="absolute inset-0 z-[70] flex items-center justify-center bg-[#11261f]/60 p-3 backdrop-blur-[3px] sm:p-5"
      >
        <motion.section
          role="dialog"
          aria-modal="true"
          aria-labelledby="rent-title"
          initial={{ opacity: 0, y: 18, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative flex max-h-[calc(100dvh-24px)] w-full max-w-[520px] flex-col overflow-hidden rounded-[10px] border border-white/80 bg-[#f9fbf6] shadow-[0_24px_80px_rgba(13,37,27,.4)]"
        >
          <header className="flex shrink-0 items-start justify-between border-b border-[#e4eae1] px-5 py-4 sm:px-6">
            <div className="min-w-0 pr-3">
              <h2 id="rent-title" className="text-xl font-extrabold text-[#1b3329]">
                Find a place to live
              </h2>
              <p className="mt-1 text-xs leading-5 text-[#68776b]">
                Rent is paid once. Your new home starts empty, so you will need to buy
                furniture from the Buy tab.
              </p>
            </div>
            {canClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#68776b] transition-colors hover:bg-[#eaf0e8] hover:text-[#1b3329] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#26724f]"
              >
                <X size={19} />
              </button>
            )}
          </header>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
            <div className="flex items-center justify-between rounded-lg border border-[#dce7d9] bg-white px-4 py-3">
              <span className="flex items-center gap-2 text-xs font-semibold text-[#718276]">
                <Coins size={16} /> You have
              </span>
              <span className="text-base font-extrabold tabular-nums text-[#26724f]">
                {formatNaira(cash)}
              </span>
            </div>

            <button
              type="button"
              disabled={loanTaken}
              onClick={() => {
                setTakeLoan((value) => !value);
                setError(null);
              }}
              aria-pressed={loanActive}
              className={`flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#26724f] disabled:cursor-not-allowed disabled:opacity-60 ${
                loanActive
                  ? "border-[#20b978] bg-[#eaf7ef]"
                  : "border-[#dce7d9] bg-white hover:bg-[#f4f9f2]"
              }`}
            >
              <Landmark size={20} className="mt-0.5 shrink-0 text-[#26724f]" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-[#284b35]">
                  {loanTaken ? "Starter loan already used" : `Starter loan of ${formatNaira(LOAN_OFFER)}`}
                </span>
                <span className="mt-1 block text-xs leading-5 text-[#68776b]">
                  {loanTaken
                    ? "You can only take the starter loan once."
                    : "The money is added to your cash straight away, enough to rent a self-con. You will owe it back, and you can repay whenever you have cash."}
                </span>
              </span>
              {loanActive && <BadgeCheck size={20} className="mt-0.5 shrink-0 text-[#20b978]" />}
            </button>

            <ul className="space-y-3">
              {HOUSING_PLANS.map((plan) => {
                const shortBy = plan.price - available;
                const affordable = shortBy <= 0;

                return (
                  <li
                    key={plan.id}
                    className="rounded-lg border border-[#dce7d9] bg-white p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#eaf4e8] text-2xl">
                        {plan.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-extrabold text-[#1b3329]">{plan.name}</h3>
                        <p className="mt-0.5 text-xs leading-5 text-[#68776b]">{plan.blurb}</p>
                        <p className="mt-1.5 text-[11px] font-semibold text-[#819084]">
                          {plan.features.join(", ")}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="text-base font-extrabold tabular-nums text-[#1b3329]">
                        {formatNaira(plan.price)}
                      </span>
                      <button
                        type="button"
                        disabled={!affordable}
                        onClick={() => rent(plan.id)}
                        className="rounded-full bg-[#20b978] px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#159e65] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#26724f] disabled:cursor-not-allowed disabled:bg-[#d8e1d8] disabled:text-[#7a877d]"
                      >
                        {affordable ? "Rent this place" : `Need ${formatNaira(shortBy)} more`}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            {error && (
              <p role="alert" className="rounded-md bg-[#fdeceb] px-3 py-2 text-xs font-semibold text-[#a14836]">
                {error}
              </p>
            )}
          </div>

          <footer className="shrink-0 border-t border-[#e4eae1] bg-white/80 px-5 py-3 sm:px-6">
            <button
              type="button"
              onClick={onSleepRough}
              className="w-full rounded-full border border-[#cbd9c8] bg-white px-4 py-2.5 text-xs font-bold text-[#4d6254] transition-colors hover:bg-[#f0f5ee] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#26724f]"
            >
              Not now. I will sleep under the bridge and earn money first
            </button>
          </footer>
        </motion.section>
      </motion.div>
    </AnimatePresence>
  );
}