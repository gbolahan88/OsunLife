// components/game/MessagesApp.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Send } from "lucide-react";
import {
  useMultiplayer,
  type ThreadTarget,
} from "@/components/multiplayer/MultiplayerProvider";

const AVATAR_COLORS = ["#d65b3f", "#2876b9", "#4b925c", "#a64b70", "#e0ad38", "#7955e8", "#16a085"];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-extrabold uppercase text-white"
      style={{ width: size, height: size, backgroundColor: avatarColor(name), fontSize: size * 0.42 }}
    >
      {name.charAt(0)}
    </span>
  );
}

function timeLabel(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

export function MessagesApp() {
  const { activeThread } = useMultiplayer();
  return activeThread ? <Thread target={activeThread} /> : <ConversationList />;
}

function ConversationList() {
  const { players, conversations, openThread } = useMultiplayer();

  return (
    <div className="space-y-4">
      <section>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#728274]">Online now</p>
        {players.length === 0 ? (
          <p className="rounded-2xl bg-white p-4 text-xs leading-5 text-[#728274] shadow-sm">
            No one else is online right now. When they are, you can start a chat here.
          </p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {players.map((player) => (
              <button
                key={player.userId}
                type="button"
                onClick={() => openThread({ userId: player.userId, username: player.username })}
                className="flex w-16 shrink-0 flex-col items-center gap-1"
              >
                <span className="relative">
                  <Avatar name={player.username} size={46} />
                  <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[#edf2eb] bg-[#20b978]" />
                </span>
                <span className="w-full truncate text-center text-[10px] font-bold text-[#263d31]">
                  {player.username}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#728274]">Chats</p>
        {conversations.length === 0 ? (
          <p className="rounded-2xl bg-white p-4 text-xs leading-5 text-[#728274] shadow-sm">
            No messages yet. Tap a player in a club or lounge, or someone from Online now, to say hello.
          </p>
        ) : (
          <div className="space-y-2">
            {conversations.map((conversation) => (
              <button
                key={conversation.userId}
                type="button"
                onClick={() => openThread({ userId: conversation.userId, username: conversation.username })}
                className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm"
              >
                <Avatar name={conversation.username} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-extrabold text-[#263d31]">{conversation.username}</span>
                    <span className="shrink-0 text-[10px] text-[#728274]">{timeLabel(conversation.last.createdAt)}</span>
                  </span>
                  <span
                    className={`block truncate text-xs ${conversation.unread ? "font-bold text-[#263d31]" : "text-[#728274]"}`}
                  >
                    {conversation.last.body}
                  </span>
                </span>
                {conversation.unread > 0 && (
                  <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#20b978] px-1.5 text-[10px] font-extrabold text-white">
                    {conversation.unread}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Thread({ target }: { target: ThreadTarget }) {
  const { userId, messages, players, sendMessage, markRead } = useMultiplayer();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const thread = useMemo(
    () =>
      messages.filter(
        (m) =>
          (m.senderId === target.userId && m.recipientId === userId) ||
          (m.senderId === userId && m.recipientId === target.userId),
      ),
    [messages, target.userId, userId],
  );
  const online = players.some((player) => player.userId === target.userId);

  useEffect(() => {
    void markRead(target.userId);
  }, [target.userId, thread.length, markRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [thread.length]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (sending || !text.trim()) return;
    setSending(true);
    setError(null);
    const result = await sendMessage(target, text);
    setSending(false);
    if (result.ok) setText("");
    else setError(result.reason);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#728274]">
        <span className={`h-2 w-2 rounded-full ${online ? "bg-[#20b978]" : "bg-[#b6beb8]"}`} />
        {online ? "Online now" : "Offline. They will see your message later."}
      </p>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {thread.length === 0 && (
          <p className="rounded-2xl bg-white p-4 text-center text-xs text-[#728274] shadow-sm">
            Say hello to {target.username}.
          </p>
        )}
        {thread.map((message) => {
          const mine = message.senderId === userId;
          return (
            <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-[13px] leading-5 shadow-sm ${
                  mine ? "rounded-br-md bg-[#20b978] text-white" : "rounded-bl-md bg-white text-[#263d31]"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{message.body}</p>
                <p className={`mt-0.5 text-right text-[9px] ${mine ? "text-white/70" : "text-[#728274]"}`}>
                  {timeLabel(message.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p className="mt-2 text-[11px] font-semibold text-[#b44235]">{error}</p>}

      <form onSubmit={submit} className="mt-2 flex items-center gap-2">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={500}
          placeholder={`Message ${target.username}`}
          className="h-10 min-w-0 flex-1 rounded-full border border-[#d5ded4] bg-white px-4 text-[13px] text-[#263d31] outline-none focus:border-[#20b978]"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          aria-label="Send message"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#20b978] text-white disabled:opacity-50"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}

export function ContactsApp() {
  const { players, openThread } = useMultiplayer();

  if (players.length === 0) {
    return (
      <p className="mt-5 rounded-3xl bg-white p-5 text-sm leading-6 text-[#728274] shadow-sm">
        No one else is online right now.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      {players.map((player) => (
        <div key={player.userId} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
          <span className="relative">
            <Avatar name={player.username} />
            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-[#20b978]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-extrabold text-[#263d31]">{player.username}</span>
            <span className="block text-[11px] text-[#728274]">Online now</span>
          </span>
          <button
            type="button"
            onClick={() => openThread({ userId: player.userId, username: player.username })}
            className="rounded-full bg-[#e9f5ed] px-3 py-1.5 text-[11px] font-bold text-[#26724f]"
          >
            Message
          </button>
        </div>
      ))}
    </div>
  );
}