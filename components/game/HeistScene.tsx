"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, DoorOpen, LockKeyhole } from "lucide-react";

const HEIST_DURATION_SECONDS = 15;

export default function HeistScene({
  onResolve,
}: {
  onResolve: (escaped: boolean) => Promise<boolean>;
}) {
  const [secondsRemaining, setSecondsRemaining] = useState(HEIST_DURATION_SECONDS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestInFlight = useRef(false);

  const resolveHeist = useCallback(async (escaped: boolean) => {
    if (requestInFlight.current) return false;
    requestInFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const succeeded = await onResolve(escaped);
      if (!succeeded) {
        setBusy(false);
        setError("Could not complete the heist. Try again.");
      }
      return succeeded;
    } finally {
      requestInFlight.current = false;
    }
  }, [onResolve]);

  useEffect(() => {
    if (secondsRemaining === 0) {
      void resolveHeist(false).catch((cause: unknown) => {
        console.error("[HeistScene] Failed to resolve timed heist:", cause);
        setBusy(false);
        setError("Could not complete the heist. Try again.");
      });
      return;
    }

    const timer = window.setTimeout(
      () => setSecondsRemaining((remaining) => Math.max(remaining - 1, 0)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [resolveHeist, secondsRemaining]);

  const progress = ((HEIST_DURATION_SECONDS - secondsRemaining) / HEIST_DURATION_SECONDS) * 100;
  const tensionText = secondsRemaining > 9
    ? "Guards are nearby..."
    : secondsRemaining > 4
      ? "Almost got it..."
      : "The vault is opening...";

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center overflow-y-auto bg-[#100d0b] px-4 py-8 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(151,57,34,0.42),transparent_58%),linear-gradient(155deg,#171310_0%,#080909_70%)]" />
      <div className="absolute inset-x-0 top-0 h-1 bg-red-950">
        <div className="h-full bg-red-500 transition-[width] duration-1000" style={{ width: `${progress}%` }} />
      </div>

      <section className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-black/55 p-6 shadow-2xl backdrop-blur-md sm:p-9">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-red-300/20 bg-red-500/10 text-red-300">
          <LockKeyhole size={32} />
        </div>
        <p className="mt-5 text-center text-[10px] font-black uppercase tracking-[0.3em] text-red-300">
          Osun Community Bank · Heist in progress
        </p>
        <h1 className="mt-2 text-center text-3xl font-black tracking-tight sm:text-4xl">
          Cracking the vault...
        </h1>

        <div className="my-8 flex items-center justify-center">
          <div className="flex h-32 w-32 flex-col items-center justify-center rounded-full border-4 border-red-400/20 bg-black/40 shadow-[0_0_45px_rgba(239,68,68,0.12)]">
            <span className="text-5xl font-black tabular-nums">{secondsRemaining}</span>
            <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">seconds</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs font-bold text-white/70">
          <span>Vault progress</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div
          role="progressbar"
          aria-label="Cracking the vault"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          className="mt-2 h-3 overflow-hidden rounded-full bg-white/10"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-red-500 transition-[width] duration-1000"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="mt-5 flex min-h-6 items-center justify-center gap-2 text-center text-sm font-bold text-amber-200">
          <AlertTriangle size={15} />
          {tensionText}
        </p>
        {error && <p role="alert" className="mt-3 text-center text-sm font-semibold text-red-200">{error}</p>}

        {secondsRemaining === 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void resolveHeist(false)}
            className="mt-5 w-full rounded-xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold transition hover:bg-white/15 disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? "Finalizing heist..." : "Retry full heist"}
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => void resolveHeist(true).then((succeeded) => {
            if (!succeeded) setError("Could not complete the escape. Try again.");
          }).catch((cause: unknown) => {
            console.error("[HeistScene] Failed to resolve escape:", cause);
            setBusy(false);
            setError("Could not complete the escape. Try again.");
          })}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-[#e6a93c] px-5 py-4 text-sm font-black text-[#24180a] shadow-lg transition hover:bg-[#f1ba55] disabled:cursor-wait disabled:opacity-60"
        >
          <DoorOpen size={18} />
          {busy ? "Getting away..." : "Escape with partial loot"}
        </button>
        <p className="mt-3 text-center text-[11px] leading-relaxed text-white/45">
          Escape now for a smaller take. Finish cracking the vault for the full haul, but the police will be alerted.
        </p>
      </section>
    </div>
  );
}
