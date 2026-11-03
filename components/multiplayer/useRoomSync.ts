// components/multiplayer/useRoomSync.ts
"use client";

import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { peekBrowserClient } from "@/lib/supabase-browser";

export type RoomAction = "idle" | "walk" | "sit" | "dance";
export type RoomPose = { x: number; z: number; ry: number; action: RoomAction };
export type RemotePose = RoomPose & { at: number };

/** Something a player did in the room. Amounts are never sent: the receiver looks them up. */
export type RoomEvent = { t: "react"; u: string; r: string };

const ACTIONS: RoomAction[] = ["idle", "walk", "sit", "dance"];
const LIMIT_X = 12;
const LIMIT_Z = 9;
const SEND_EVERY_MS = 150;
const HEARTBEAT_MS = 1000;
const STALE_MS = 6000;
const EVENT_MIN_GAP_MS = 400;
const ID_PATTERN = /^[a-z0-9-]{1,40}$/;

function bounded(value: unknown, limit: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(-limit, Math.min(limit, value));
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Shares your position inside a building, receives everyone else's,
 * and carries small room events (purchases, reactions).
 * Poses live in a ref (not React state) so 60fps movement never re-renders React.
 */
export function useRoomSync(
  roomId: string,
  userId: string,
  local: MutableRefObject<RoomPose>,
  onEvent?: (event: RoomEvent) => void,
): {
  remote: MutableRefObject<Map<string, RemotePose>>;
  sendEvent: (event: RoomEvent) => void;
} {
  const remote = useRef(new Map<string, RemotePose>());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscribedRef = useRef(false);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    const client = peekBrowserClient();
    if (!client || !userId) return;

    const poses = remote.current;
    poses.clear();
    const lastEventAt = new Map<string, number>();

    const channel: RealtimeChannel = client.channel(`osun-life:room:${roomId}`, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel.on(
      "broadcast",
      { event: "pose" },
      ({ payload }: { payload?: unknown }) => {
        const p = payload as Record<string, unknown> | null | undefined;
        if (!p || typeof p.u !== "string" || p.u === userId || p.u.length > 64) return;

        const x = bounded(p.x, LIMIT_X);
        const z = bounded(p.z, LIMIT_Z);
        const ry = bounded(p.ry, 10);
        if (x === null || z === null || ry === null) return;

        const action = ACTIONS.includes(p.a as RoomAction) ? (p.a as RoomAction) : "idle";
        poses.set(p.u, { x, z, ry, action, at: performance.now() });
      },
    );

    channel.on(
      "broadcast",
      { event: "fx" },
      ({ payload }: { payload?: unknown }) => {
        const p = payload as Record<string, unknown> | null | undefined;
        if (!p || typeof p.u !== "string" || p.u === userId || p.u.length > 64) return;

        // One event per sender every 400ms at most, so nobody can flood the room
        const now = performance.now();
        if (now - (lastEventAt.get(p.u) ?? 0) < EVENT_MIN_GAP_MS) return;
        lastEventAt.set(p.u, now);

        if (p.t === "react" && typeof p.r === "string" && ID_PATTERN.test(p.r)) {
          onEventRef.current?.({ t: "react", u: p.u, r: p.r });
        }
      },
    );

    subscribedRef.current = false;
    channel.subscribe((status: string) => {
      subscribedRef.current = status === "SUBSCRIBED";
    });

    let last = { x: NaN, z: NaN, ry: NaN, action: "" };
    let lastSentAt = 0;

    const sender = window.setInterval(() => {
      if (!subscribedRef.current) return;
      const now = performance.now();
      const cur = local.current;

      const unchanged =
        Math.abs(cur.x - last.x) <= 0.02 &&
        Math.abs(cur.z - last.z) <= 0.02 &&
        Math.abs(cur.ry - last.ry) <= 0.05 &&
        cur.action === last.action;
      if (unchanged && now - lastSentAt < HEARTBEAT_MS) return;

      last = { x: cur.x, z: cur.z, ry: cur.ry, action: cur.action };
      lastSentAt = now;
      void channel.send({
        type: "broadcast",
        event: "pose",
        payload: { u: userId, x: round2(cur.x), z: round2(cur.z), ry: round2(cur.ry), a: cur.action },
      });
    }, SEND_EVERY_MS);

    // Forget players who stopped sending (closed the tab, left the building)
    const pruner = window.setInterval(() => {
      const now = performance.now();
      for (const [key, pose] of poses) {
        if (now - pose.at > STALE_MS) poses.delete(key);
      }
    }, 2000);

    return () => {
      window.clearInterval(sender);
      window.clearInterval(pruner);
      poses.clear();
      subscribedRef.current = false;
      channelRef.current = null;
      void client.removeChannel(channel);
    };
  }, [roomId, userId, local]);

  const sendEvent = useCallback((event: RoomEvent) => {
    const channel = channelRef.current;
    if (!channel || !subscribedRef.current) return;
    void channel.send({ type: "broadcast", event: "fx", payload: event });
  }, []);

  return { remote, sendEvent };
}