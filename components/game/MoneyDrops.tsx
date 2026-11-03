// components/game/MoneyDrops.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatNaira } from "@/lib/format";
import { claimDrop } from "@/lib/wallet";
import { useGameStore } from "@/store/gameStore";
import type { MoneyDropRow } from "@/components/multiplayer/useVenueRealtime";

type Note = {
  id: string;
  amount: number;
  /** Your own spray: you can watch it fall but not pick it up */
  mine: boolean;
  left: number;
  delay: number;
  duration: number;
};

type Pop = { id: number; text: string; ok: boolean };

export function useMoneyDrops() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [pops, setPops] = useState<Pop[]>([]);
  const timers = useRef<number[]>([]);
  const popId = useRef(0);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((id) => window.clearTimeout(id));
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const remove = useCallback((id: string) => {
    setNotes((current) => current.filter((note) => note.id !== id));
  }, []);

  const add = useCallback(
    (row: MoneyDropRow, mine: boolean) => {
      const duration = 6 + Math.random() * 2.5;
      const delay = Math.random() * 1.4;
      setNotes((current) =>
        current.some((note) => note.id === row.id)
          ? current
          : [...current, { id: row.id, amount: row.amount, mine, left: 6 + Math.random() * 86, delay, duration }],
      );
      // Gone from the screen once it has fallen
      later(() => remove(row.id), (delay + duration) * 1000 + 600);
    },
    [later, remove],
  );

  const showPop = useCallback(
    (message: string, ok: boolean) => {
      popId.current += 1;
      const id = popId.current;
      setPops((current) => [...current.slice(-2), { id, text: message, ok }]);
      later(() => setPops((current) => current.filter((pop) => pop.id !== id)), 2400);
    },
    [later],
  );

  const claim = useCallback(
    async (id: string) => {
      remove(id);
      const result = await claimDrop(id);
      if (result.ok) {
        useGameStore.getState().applyServerBalance(result.balance, result.version);
        showPop(`+${formatNaira(result.amount)}`, true);
      } else {
        showPop(result.reason, false);
      }
    },
    [remove, showPop],
  );

  return { notes, pops, add, remove, claim };
}

export function MoneyDropsLayer({ drops }: { drops: ReturnType<typeof useMoneyDrops> }) {
  const { notes, pops, claim } = drops;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      <style>{`
        @keyframes drop-fall {
          0% { transform: translateY(0) rotate(-8deg); opacity: 0; }
          6% { opacity: 1; }
          50% { transform: translateY(58vh) rotate(10deg); }
          100% { transform: translateY(116vh) rotate(-8deg); opacity: 1; }
        }
        @keyframes drop-pop {
          0% { transform: translate(-50%, 8px) scale(0.8); opacity: 0; }
          20% { transform: translate(-50%, 0) scale(1.05); opacity: 1; }
          100% { transform: translate(-50%, -22px) scale(1); opacity: 0; }
        }
      `}</style>

      {notes.map((note) => (
        <button
          key={note.id}
          type="button"
          disabled={note.mine}
          onClick={() => void claim(note.id)}
          aria-label={`Pick up ${formatNaira(note.amount)}`}
          className={`absolute flex flex-col items-center gap-0.5 ${
            note.mine ? "pointer-events-none opacity-60" : "pointer-events-auto cursor-pointer"
          }`}
          style={{
            top: "-12%",
            left: `${note.left}%`,
            animation: `drop-fall ${note.duration}s linear ${note.delay}s both`,
          }}
        >
          <span className="text-4xl leading-none drop-shadow-lg">💵</span>
          <span className="rounded-full bg-black/65 px-1.5 py-0.5 text-[9px] font-extrabold text-[#9dffb8]">
            {formatNaira(note.amount)}
          </span>
        </button>
      ))}

      {pops.map((pop, index) => (
        <p
          key={pop.id}
          className={`absolute left-1/2 rounded-full px-4 py-1.5 text-sm font-extrabold shadow-lg ${
            pop.ok ? "bg-[#17a05d] text-white" : "bg-black/75 text-white"
          }`}
          style={{ top: `${34 + index * 7}%`, animation: "drop-pop 2.2s ease-out both" }}
        >
          {pop.text}
        </p>
      ))}
    </div>
  );
}