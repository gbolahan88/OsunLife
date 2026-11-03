// components/multiplayer/useVenueRealtime.ts
"use client";

import { useEffect, useRef } from "react";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { peekBrowserClient } from "@/lib/supabase-browser";

export type VenueEventRow = {
  id: string;
  venue: string;
  user_id: string;
  username: string;
  action_id: string;
  created_at: string;
};

export type MoneyDropRow = {
  id: string;
  venue: string;
  sprayer_id: string;
  sprayer_username: string;
  amount: number;
  claimed_by: string | null;
  created_at: string;
};

type Handlers = {
  onEvent: (row: VenueEventRow) => void;
  onDrop: (row: MoneyDropRow) => void;
  onDropClaimed: (id: string) => void;
};

const text = (value: unknown, max: number): string | null =>
  typeof value === "string" && value.length > 0 && value.length <= max ? value : null;

function readEvent(raw: Record<string, unknown>): VenueEventRow | null {
  const id = text(raw.id, 64);
  const venue = text(raw.venue, 40);
  const userId = text(raw.user_id, 64);
  const username = text(raw.username, 40);
  const actionId = text(raw.action_id, 40);
  if (!id || !venue || !userId || !username || !actionId) return null;
  return {
    id, venue, user_id: userId, username, action_id: actionId,
    created_at: typeof raw.created_at === "string" ? raw.created_at : "",
  };
}

function readDrop(raw: Record<string, unknown>): MoneyDropRow | null {
  const id = text(raw.id, 64);
  const venue = text(raw.venue, 40);
  const sprayerId = text(raw.sprayer_id, 64);
  const name = text(raw.sprayer_username, 40);
  const amount = typeof raw.amount === "number" && Number.isFinite(raw.amount) ? raw.amount : null;
  if (!id || !venue || !sprayerId || !name || amount === null || amount < 1) return null;
  return {
    id, venue, sprayer_id: sprayerId, sprayer_username: name, amount,
    claimed_by: typeof raw.claimed_by === "string" ? raw.claimed_by : null,
    created_at: typeof raw.created_at === "string" ? raw.created_at : "",
  };
}

/**
 * Club purchases and sprayed notes come from the database, not from other players' browsers,
 * so nobody can fake a banner or a note. Pass null to switch it off (non-venue buildings).
 */
export function useVenueRealtime(venueId: string | null, handlers: Handlers) {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!venueId) return;
    const client = peekBrowserClient();
    if (!client) return;

    const filter = `venue=eq.${venueId}`;
    const channel: RealtimeChannel = client
      .channel(`osun-life:venue:${venueId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "venue_events", filter },
        (change: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const row = readEvent(change.new as Record<string, unknown>);
          if (row) handlersRef.current.onEvent(row);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "money_drops", filter },
        (change: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const row = readDrop(change.new as Record<string, unknown>);
          if (row) handlersRef.current.onDrop(row);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "money_drops", filter },
        (change: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const row = change.new as Record<string, unknown>;
          const id = text(row.id, 64);
          if (id && (typeof row.claimed_by === "string" || row.refunded === true)) {
            handlersRef.current.onDropClaimed(id);
          }
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [venueId]);
}