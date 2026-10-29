// components/multiplayer/MultiplayerProvider.tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { getBrowserClient } from "@/lib/supabase-browser";
import {
  CharacterAppearance,
  DEFAULT_CHARACTER_APPEARANCE,
} from "@/store/characterAppearance";

/* ───────────────────────────── types ───────────────────────────── */

export type RemotePlayer = {
  userId: string;
  username: string;
  appearance: CharacterAppearance;
  /** "map", a building id such as "zeus-club", or "private" (home, shop) */
  place: string;
};

export type ThreadTarget = { userId: string; username: string };

export type ChatMessage = {
  id: string;
  senderId: string;
  recipientId: string;
  senderUsername: string;
  recipientUsername: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

export type Conversation = {
  userId: string;
  username: string;
  last: ChatMessage;
  unread: number;
};

export type SendResult = { ok: true } | { ok: false; reason: string };

type PresencePayload = {
  username: string;
  appearance: CharacterAppearance;
  place: string;
};

type MessageRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  sender_username: string;
  recipient_username: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

type MultiplayerValue = {
  userId: string;
  username: string;
  /** Everyone else who is online right now */
  players: RemotePlayer[];
  /** Everyone online, including you */
  onlineCount: number;
  messages: ChatMessage[];
  conversations: Conversation[];
  unreadTotal: number;
  activeThread: ThreadTarget | null;
  openThread: (target: ThreadTarget | null) => void;
  sendMessage: (to: ThreadTarget, body: string) => Promise<SendResult>;
  markRead: (otherUserId: string) => Promise<void>;
};

/* ───────────────────────────── helpers ───────────────────────────── */

const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

function cleanUsername(value: unknown): string {
  return typeof value === "string" && USERNAME_PATTERN.test(value) ? value : "Player";
}

/** Other players send their look over the network, so never trust it. */
function sanitizeAppearance(raw: unknown): CharacterAppearance {
  const a = (raw ?? {}) as Record<string, unknown>;
  const fallback = DEFAULT_CHARACTER_APPEARANCE;
  const color = (value: unknown, def: string) =>
    typeof value === "string" && COLOR_PATTERN.test(value) ? value : def;

  return {
    ...fallback,
    gender: (a.gender === "Man" || a.gender === "Woman"
      ? a.gender
      : fallback.gender) as CharacterAppearance["gender"],
    skin: color(a.skin, fallback.skin),
    hair: color(a.hair, fallback.hair),
    shirt: color(a.shirt, fallback.shirt),
    trousers: color(a.trousers, fallback.trousers),
  };
}

function toMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    senderUsername: row.sender_username,
    recipientUsername: row.recipient_username,
    body: row.body,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const message of current) byId.set(message.id, message);
  for (const message of incoming)
    byId.set(message.id, { ...byId.get(message.id), ...message });
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/* ───────────────────────────── context ───────────────────────────── */

const noopSend = async (): Promise<SendResult> => ({
  ok: false,
  reason: "Chat is not available.",
});

const defaultValue: MultiplayerValue = {
  userId: "",
  username: "",
  players: [],
  onlineCount: 1,
  messages: [],
  conversations: [],
  unreadTotal: 0,
  activeThread: null,
  openThread: () => {},
  sendMessage: noopSend,
  markRead: async () => {},
};

const MultiplayerContext = createContext<MultiplayerValue>(defaultValue);

export function useMultiplayer() {
  return useContext(MultiplayerContext);
}

/* ───────────────────────────── provider ───────────────────────────── */

export function MultiplayerProvider({
  supabaseUrl,
  supabaseKey,
  userId,
  username,
  appearance,
  place,
  onIncomingMessage,
  children,
}: {
  supabaseUrl: string;
  supabaseKey: string;
  userId: string;
  username: string;
  appearance: CharacterAppearance;
  place: string;
  onIncomingMessage?: (fromUsername: string, body: string) => void;
  children: ReactNode;
}) {
  // Typed as BrowserClient — no longer `any`.
  const supabase = useMemo(
    () => getBrowserClient(supabaseUrl, supabaseKey),
    [supabaseUrl, supabaseKey],
  );

  const [players, setPlayers] = useState<RemotePlayer[]>([]);
  const [onlineCount, setOnlineCount] = useState(1);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeThread, setActiveThread] = useState<ThreadTarget | null>(null);

  const payload = useMemo<PresencePayload>(
    () => ({ username, appearance, place }),
    [username, appearance, place],
  );
  const payloadRef = useRef(payload);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscribedRef = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  const onIncomingRef = useRef(onIncomingMessage);

  useEffect(() => {
    onIncomingRef.current = onIncomingMessage;
  }, [onIncomingMessage]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  /* ── Presence: who is online, and where ── */
  useEffect(() => {
    // `channel()` does NOT accept a `config` wrapper.
    // Presence key comes from `subscribe(..., { key })`.
    const channel = supabase.channel("osun-life:world", {
      config: { presence: { key: userId } },
    });
    channelRef.current = channel;

    const sync = () => {
      // channel is now typed => presenceState<PresencePayload>() is valid
      const state = channel.presenceState<PresencePayload>();
      const next: RemotePlayer[] = [];
      for (const [key, metas] of Object.entries(state)) {
        if (key === userId) continue;
        const meta = metas[metas.length - 1];
        if (!meta) continue;
        next.push({
          userId: key,
          username: cleanUsername(meta.username),
          appearance: sanitizeAppearance(meta.appearance),
          place:
            typeof meta.place === "string" ? meta.place.slice(0, 40) : "private",
        });
      }
      setPlayers(next);
      setOnlineCount(Math.max(1, Object.keys(state).length));
    };

    channel.on("presence", { event: "sync" }, sync).subscribe((status) => {
      if (status === "SUBSCRIBED") {
        subscribedRef.current = true;
        void channel.track(payloadRef.current);
      }
    });

    return () => {
      subscribedRef.current = false;
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  // Tell everyone when you move to another place or change your look
  useEffect(() => {
    payloadRef.current = payload;
    if (subscribedRef.current) void channelRef.current?.track(payload);
  }, [payload]);

  /* ── Chat: history + live incoming messages ── */
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (cancelled || error || !data) return;
      setMessages((current) =>
        mergeMessages(current, (data as MessageRow[]).map(toMessage)),
      );
    })();

    const inbox = supabase
      .channel(`osun-life:inbox:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${userId}`,
        },
        // Explicitly typed — silences the implicit-any on older SDKs
        // and matches what the typed overload supplies anyway.
        (change: RealtimePostgresChangesPayload<MessageRow>) => {
          const row = change.new as MessageRow | undefined;
          if (!row || !row.id) return;
          const message = toMessage(row);
          setMessages((current) => mergeMessages(current, [message]));
          onIncomingRef.current?.(message.senderUsername, message.body);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(inbox);
    };
  }, [supabase, userId]);

  const sendMessage = useCallback(
    async (to: ThreadTarget, body: string): Promise<SendResult> => {
      const text = body.trim().slice(0, 500);
      if (!text) return { ok: false, reason: "Type a message first." };

      const { data, error } = await supabase
        .from("messages")
        .insert({
          sender_id: userId,
          recipient_id: to.userId,
          body: text,
        })
        .select("*")
        .single();

      if (error || !data) {
        return { ok: false, reason: "Could not send. Try again." };
      }
      setMessages((current) =>
        mergeMessages(current, [toMessage(data as MessageRow)]),
      );
      return { ok: true };
    },
    [supabase, userId],
  );

  const markRead = useCallback(
    async (otherUserId: string) => {
      const hasUnread = messagesRef.current.some(
        (m) =>
          m.senderId === otherUserId &&
          m.recipientId === userId &&
          !m.readAt,
      );
      if (!hasUnread) return;

      const now = new Date().toISOString();
      setMessages((current) =>
        current.map((m) =>
          m.senderId === otherUserId && m.recipientId === userId && !m.readAt
            ? { ...m, readAt: now }
            : m,
        ),
      );
      await supabase
        .from("messages")
        .update({ read_at: now })
        .eq("recipient_id", userId)
        .eq("sender_id", otherUserId)
        .is("read_at", null);
    },
    [supabase, userId],
  );

  const conversations = useMemo<Conversation[]>(() => {
    const byPlayer = new Map<string, Conversation>();
    for (const message of messages) {
      const mine = message.senderId === userId;
      const otherId = mine ? message.recipientId : message.senderId;
      const otherName = mine
        ? message.recipientUsername
        : message.senderUsername;
      const unread = !mine && !message.readAt ? 1 : 0;
      const entry = byPlayer.get(otherId);
      if (!entry) {
        byPlayer.set(otherId, {
          userId: otherId,
          username: otherName,
          last: message,
          unread,
        });
      } else {
        entry.last = message;
        entry.unread += unread;
      }
    }
    return [...byPlayer.values()].sort((a, b) =>
      b.last.createdAt.localeCompare(a.last.createdAt),
    );
  }, [messages, userId]);

  const unreadTotal = useMemo(
    () =>
      conversations.reduce(
        (total, conversation) => total + conversation.unread,
        0,
      ),
    [conversations],
  );

  const value = useMemo<MultiplayerValue>(
    () => ({
      userId,
      username,
      players,
      onlineCount,
      messages,
      conversations,
      unreadTotal,
      activeThread,
      openThread: setActiveThread,
      sendMessage,
      markRead,
    }),
    [
      userId,
      username,
      players,
      onlineCount,
      messages,
      conversations,
      unreadTotal,
      activeThread,
      sendMessage,
      markRead,
    ],
  );

  return (
    <MultiplayerContext.Provider value={value}>
      {children}
    </MultiplayerContext.Provider>
  );
}