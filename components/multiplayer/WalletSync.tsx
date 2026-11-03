// components/multiplayer/WalletSync.tsx
"use client";

import { useEffect } from "react";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { peekBrowserClient } from "@/lib/supabase-browser";
import { useMultiplayer } from "@/components/multiplayer/MultiplayerProvider";
import { useGameStore } from "@/store/gameStore";

/**
 * Keeps the on-screen cash equal to the server balance:
 * loads it on start, and listens for changes (money received, notes claimed, refunds).
 */
export default function WalletSync({ onNotice }: { onNotice?: (text: string) => void }) {
  const { userId } = useMultiplayer();
  const syncWallet = useGameStore((state) => state.syncWallet);
  const applyServerBalance = useGameStore((state) => state.applyServerBalance);
  const notice = useGameStore((state) => state.walletNotice);

  useEffect(() => {
    if (!userId) return;
    void syncWallet();

    const client = peekBrowserClient();
    if (!client) return;

    const channel: RealtimeChannel = client
      .channel(`osun-life:wallet:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${userId}` },
        (change: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const row = change.new as Record<string, unknown>;
          if (typeof row.balance === "number" && typeof row.version === "number") {
            applyServerBalance(row.balance, row.version);
          }
        },
      )
      .subscribe((status: string) => {
        // After a reconnect, catch up on anything we missed
        if (status === "SUBSCRIBED") void syncWallet();
      });

    return () => {
      void client.removeChannel(channel);
    };
  }, [userId, syncWallet, applyServerBalance]);

  // Messages like "Not enough cash" come from the store; show them once
  useEffect(() => {
    if (!notice) return;
    onNotice?.(notice);
    useGameStore.setState({ walletNotice: null });
  }, [notice, onNotice]);

  return null;
}