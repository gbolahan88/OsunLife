"use client";

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, LoaderCircle, Send, MapPin } from "lucide-react";
import { useMultiplayer, type RemotePlayer } from "@/components/multiplayer/MultiplayerProvider";
import { REACTIONS } from "@/lib/venue";
import type { CrimeAction, CrimeResult, CrimeStatus } from "@/lib/wallet";
import { formatNaira } from "@/lib/format";

export type BuildingPopupAction = {
  id: CrimeAction;
  emoji: string;
  label: string;
  requiresStatus: CrimeStatus;
};

export type BuildingPopupSpot = {
  emoji: string;
  label: string;
  x: number;
  z: number;
};

export type BuildingPopupConfig = {
  emoji: string;
  title: string;
  subtitle: string;
  staff: string;
  actions: BuildingPopupAction[];
  spots: BuildingPopupSpot[];
};

const subscribeToPortalRoot = () => () => {};
const getPortalRoot = () => document.body;
const getServerPortalRoot = () => null;

export default function BuildingPopupUI({
  config,
  here,
  crimeState,
  crimeNotice,
  crimeLoading,
  crimeBusy,
  crimeLoadFailed,
  onClose,
  onWalkToSpot,
  onReact,
  onAction,
  onRetry,
  onReport,
}: {
  config: BuildingPopupConfig;
  here: RemotePlayer[];
  crimeState: CrimeResult | null;
  crimeNotice: string | null;
  crimeLoading: boolean;
  crimeBusy: boolean;
  crimeLoadFailed: boolean;
  onClose: () => void;
  onWalkToSpot: (spot: BuildingPopupSpot) => void;
  onReact: (reaction: string) => void;
  onAction: (action: CrimeAction) => void;
  onRetry: () => void;
  onReport?: () => void;
}) {
  const [message, setMessage] = useState("");
  const portalRoot = useSyncExternalStore(
    subscribeToPortalRoot,
    getPortalRoot,
    getServerPortalRoot,
  );
  const { openThread } = useMultiplayer();

  if (!portalRoot) return null;

  // 👇 Wrapper that closes the popup after the action
  const handleActionClick = (actionId: CrimeAction) => {
    onAction(actionId);
    onClose();
  };

  const handleWalkToSpot = (spot: BuildingPopupSpot) => {
    onWalkToSpot(spot);
    onClose();
  };

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-[1000] flex flex-col items-center justify-end px-3"
    >
      {/* Invisible backdrop — click does nothing */}
      <div className="pointer-events-none flex-1" />

      {/* The bottom sheet */}
      <div
        className="pointer-events-auto relative mx-3 mb-20 flex max-h-[70vh] w-full max-w-lg flex-col rounded-3xl border border-white/10 bg-[#1a1a1a] text-white shadow-2xl"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain rounded-3xl modern-scrollbar">
          
          {/* Header */}
          <div className="flex items-center justify-between p-5 pb-2">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2a2a2a] text-2xl">
                {config.emoji}
              </div>
              <div>
                <h2 className="text-xl font-extrabold">{config.title}</h2>
                <p className="text-xs text-white/60">{config.subtitle}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-white/10">
              <ChevronDown size={24} />
            </button>
          </div>

          {/* Quick actions row (Drive home, etc.) */}
          <div className="mx-5 mb-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#2a2a2a] px-3 py-2 text-xs font-bold hover:bg-[#3a3a3a]"
            >
              🚗 Drive home
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#2a2a2a] px-3 py-2 text-xs font-bold hover:bg-[#3a3a3a]"
            >
              <MapPin size={14} /> Drive to...
            </button>
          </div>

          {/* Chat input */}
          <div className="px-5 py-2">
            <div className="flex items-center gap-2 rounded-full bg-[#2a2a2a] px-4 py-2">
              <input
                type="text"
                placeholder="Say something to everyone here..."
                value={message}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-white/40"
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") setMessage("");
                }}
              />
              <button type="button" onClick={() => setMessage("")} className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold hover:bg-white/20">
                Enter
              </button>
              <button type="button" onClick={() => setMessage("")} aria-label="Send message" className="rounded-full p-2 hover:bg-white/10">
                <Send size={16} />
              </button>
            </div>
          </div>

          {/* Reactions */}
          <div className="flex justify-between px-5 py-2">
            {REACTIONS.map((reaction) => (
              <button
                type="button"
                key={reaction.id}
                onClick={() => onReact(reaction.id)}
                className="flex flex-col items-center gap-1 rounded-xl p-2 hover:bg-white/5"
              >
                <span className="text-2xl">{reaction.emoji}</span>
                <span className="text-[10px] text-white/60">{reaction.label}</span>
              </button>
            ))}
          </div>

          {/* Staff card */}
          <div className="mx-5 my-2 flex items-center gap-3 rounded-2xl bg-[#2a2a2a] p-3">
            <div className="h-10 w-10 overflow-hidden rounded-full bg-gray-700">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-white/50">On duty</p>
              <p className="text-sm font-bold">{config.staff}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="px-5 py-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Actions</h3>
              {crimeLoading && <LoaderCircle size={15} className="animate-spin text-white/60" />}
            </div>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {config.actions.map((action) => {
                const statusMatches = crimeState?.status === action.requiresStatus;
                const specialCondition =
                  (action.id !== "church_offering" || crimeState?.offeringClaimed === false);
                const disabled = crimeLoading || crimeLoadFailed || crimeBusy || !statusMatches || !specialCondition;

                return (
                  <button
                    type="button"
                    key={action.id}
                    disabled={disabled}
                    onClick={() => handleActionClick(action.id)}
                    className="flex shrink-0 items-center gap-2 rounded-full bg-[#2a2a2a] px-3 py-2 text-xs font-semibold enabled:hover:bg-[#3a3a3a] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {crimeBusy ? <LoaderCircle size={14} className="animate-spin" /> : action.emoji}
                    {action.label}
                  </button>
                );
              })}
            </div>
            {crimeState && (
              <p className="mt-1 text-[10px] text-white/45">
                Case status: {crimeState.status}
                {crimeState.stolenAmount > 0 ? ` · Amount involved: ₦${crimeState.stolenAmount.toLocaleString()}` : ""}
                {crimeState.offeringClaimed && config.actions.some((action) => action.id === "church_offering")
                  ? " · Offering already collected"
                  : ""}
              </p>
            )}
            {crimeNotice && <p role="status" className="mt-2 text-xs font-semibold text-amber-200">{crimeNotice}</p>}
            {crimeLoadFailed && (
              <button type="button" onClick={onRetry} className="mt-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold hover:bg-white/20">
                Retry connection
              </button>
            )}
          </div>

          {/* Arrest/Court banners */}
          <div className="px-5 py-2">
            {crimeState?.status === "station" && (
              <div className="mb-3 rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2">
                <p className="text-sm font-extrabold text-amber-100">You have been arrested.</p>
                <p className="mt-1 text-xs text-white/65">
                  Cash stolen: {formatNaira(crimeState.stolenAmount)}
                </p>
              </div>
            )}
            {crimeState?.status === "court" && (
              <div className="mb-3 rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2">
                <p className="text-sm font-extrabold text-amber-100">Your case is before the court.</p>
                <p className="mt-1 text-xs text-white/65">
                  Case amount: {formatNaira(crimeState.stolenAmount)}
                </p>
              </div>
            )}
          </div>

          {/* Spots */}
          <div className="px-5 py-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Spots here</h3>
              <span className="text-[10px] text-white/50">👆 Tap one to walk there</span>
            </div>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {config.spots.map((spot) => (
                <button
                  type="button"
                  key={spot.label}
                  onClick={() => handleWalkToSpot(spot)}
                  className="flex shrink-0 items-center gap-2 rounded-full bg-[#2a2a2a] px-3 py-2 text-xs font-semibold hover:bg-[#3a3a3a]"
                >
                  {spot.emoji} {spot.label}
                </button>
              ))}
            </div>
          </div>

          {/* Report */}
          {onReport && (
            <div className="px-5 py-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onReport();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-500/20"
              >
                🚔 Report a User
              </button>
            </div>
          )}

          {/* Players */}
          <div className="px-5 py-2 pb-6">
            <h3 className="text-sm font-bold">Players here · {here.length}</h3>
            <div className="mt-3 flex flex-wrap gap-4">
              {here.map((player) => (
                <button
                  type="button"
                  key={player.userId}
                  onClick={() => openThread({ userId: player.userId, username: player.username })}
                  className="flex flex-col items-center gap-1"
                >
                  <span className="h-12 w-12 overflow-hidden rounded-full border-2 border-green-500 bg-gray-700">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${player.username}`} alt="" />
                  </span>
                  <span className="text-[10px] text-white/70">{player.username}</span>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>,
    portalRoot,
  );
}