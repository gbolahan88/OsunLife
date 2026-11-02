// components/game/VenuePanel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { formatNaira } from "@/lib/format";
import {
  CONFIRM_FROM,
  REACTIONS,
  VENUE_GROUPS,
  VENUE_SPOTS,
  actionsFor,
  type VenueAction,
  type VenueGroup,
  type VenueSpot,
} from "@/lib/venue";
import type { RemotePlayer } from "@/components/multiplayer/MultiplayerProvider";

type BuyResult = { ok: true } | { ok: false; reason: string };

type VenuePanelProps = {
  venueId: string;
  venueName: string;
  cash: number;
  here: RemotePlayer[];
  dancing: boolean;
  onToggleDance: () => void;
  onReact: (reactionId: string) => void;
  onBuy: (action: VenueAction) => BuyResult;
  onWalkToSpot: (spot: VenueSpot) => void;
  onChat: (player: RemotePlayer) => void;
};

const AVATAR_COLORS = ["#d65b3f", "#2876b9", "#4b925c", "#a64b70", "#e0ad38", "#7955e8", "#16a085"];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export default function VenuePanel({
  venueId,
  venueName,
  cash,
  here,
  dancing,
  onToggleDance,
  onReact,
  onBuy,
  onWalkToSpot,
  onChat,
}: VenuePanelProps) {
  const [open, setOpen] = useState(false);
  const actions = useMemo(() => actionsFor(venueId), [venueId]);
  const groups = useMemo(
    () => VENUE_GROUPS.filter((g) => actions.some((a) => a.group === g)),
    [actions],
  );
  const [group, setGroup] = useState<VenueGroup>(() => groups[0] ?? "Drinks");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const spots = VENUE_SPOTS[venueId] ?? [];
  const visible = actions.filter((a) => a.group === group);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 2600);
    return () => window.clearTimeout(id);
  }, [notice]);

  const label = (action: VenueAction) => action.label.replace("{venue}", venueName);

  function handleBuy(action: VenueAction) {
    if (action.price >= CONFIRM_FROM && confirmId !== action.id) {
      setConfirmId(action.id);
      return;
    }
    setConfirmId(null);
    const result = onBuy(action);
    setNotice(result.ok ? `${action.emoji} ${label(action)}: done` : result.reason);
  }

  const dancePill = (
    <button
      type="button"
      onClick={onToggleDance}
      aria-pressed={dancing}
      className={`pointer-events-auto flex h-11 items-center gap-2 rounded-full border px-5 text-[13px] font-extrabold shadow-lg backdrop-blur transition-colors ${
        dancing
          ? "border-[#f04f9b] bg-[#f04f9b] text-white"
          : "border-white/80 bg-white/95 text-[#263d31]"
      }`}
    >
      <span aria-hidden>💃</span>
      {dancing ? "Stop dancing" : "Dance"}
    </button>
  );

  if (!open) {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] flex flex-col items-center gap-2 px-3">
        <p className="rounded-full bg-black/45 px-3 py-1 text-[10px] font-semibold text-white backdrop-blur">
          Tap the floor to walk
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="pointer-events-auto flex h-11 items-center gap-2 rounded-full border border-[#ffd34d]/70 bg-[#141f2b]/90 px-5 text-[13px] font-extrabold text-[#ffd34d] shadow-lg backdrop-blur"
          >
            <span aria-hidden>🎉</span>
            What to do here
          </button>
          {dancePill}
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] flex justify-center px-2 sm:px-4">
      <div className="pointer-events-auto flex max-h-[calc(100dvh-19rem)] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#141f2b]/95 text-white shadow-[0_-12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md">
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 px-4 pb-2 pt-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-extrabold">{venueName}</h2>
            <p className="text-[11px] text-white/60">
              {here.length + 1} here · You have {formatNaira(cash)}
            </p>
          </div>
          {dancePill}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80"
          >
            <ChevronDown size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {/* Reactions */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {REACTIONS.map((reaction) => (
              <button
                key={reaction.id}
                type="button"
                onClick={() => onReact(reaction.id)}
                className="flex shrink-0 flex-col items-center gap-0.5 rounded-2xl bg-white/10 px-4 py-2 text-[11px] font-bold hover:bg-white/15"
              >
                <span className="text-xl">{reaction.emoji}</span>
                {reaction.label}
              </button>
            ))}
          </div>

          {/* Spots */}
          {spots.length > 0 && (
            <>
              <p className="mb-1.5 mt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">
                Spots here · tap one to walk there
              </p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {spots.map((spot) => (
                  <button
                    key={spot.id}
                    type="button"
                    onClick={() => {
                      onWalkToSpot(spot);
                      setOpen(false);
                    }}
                    className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-[12px] font-bold hover:bg-white/15"
                  >
                    <span>{spot.emoji}</span>
                    {spot.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* What to buy */}
          <div className="mb-2 mt-3 flex gap-1.5 overflow-x-auto">
            {groups.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => {
                  setGroup(g);
                  setConfirmId(null);
                }}
                className={`shrink-0 rounded-full px-4 py-1.5 text-[12px] font-extrabold ${
                  g === group ? "bg-[#ffd34d] text-[#1b1400]" : "bg-white/10 text-white/80"
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {visible.map((action) => {
              const affordable = cash >= action.price;
              const confirming = confirmId === action.id;
              return (
                <button
                  key={action.id}
                  type="button"
                  disabled={!affordable}
                  onClick={() => handleBuy(action)}
                  className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors ${
                    confirming
                      ? "border-[#ffd34d] bg-[#3a2f10]"
                      : "border-transparent bg-white/8 hover:bg-white/12"
                  } ${affordable ? "" : "cursor-not-allowed opacity-40"}`}
                >
                  <span className="text-2xl">{action.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-extrabold">{label(action)}</span>
                    <span className="block text-[11px] text-white/60">
                      {confirming ? "Tap again to confirm" : formatNaira(action.price)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {notice && (
            <p
              role="status"
              className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-center text-[12px] font-semibold text-[#ffd34d]"
            >
              {notice}
            </p>
          )}

          {/* Players here */}
          <p className="mb-1.5 mt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">
            Players here
          </p>
          {here.length === 0 ? (
            <p className="text-[12px] text-white/50">Nobody else yet. Tell a friend to come.</p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {here.map((player) => (
                <button
                  key={player.userId}
                  type="button"
                  onClick={() => onChat(player)}
                  className="flex w-16 shrink-0 flex-col items-center gap-1"
                >
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#20b978] text-lg font-extrabold uppercase text-white"
                    style={{ backgroundColor: avatarColor(player.username) }}
                  >
                    {player.username.charAt(0)}
                  </span>
                  <span className="w-full truncate text-center text-[10px] font-bold text-white/80">
                    @{player.username}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}