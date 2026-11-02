// components/game/ClubFx.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VenueAction } from "@/lib/venue";

type Banner = { id: number; kind: "hype" | "dj" | "owns"; name: string; venue: string };
type FeedItem = { id: number; text: string };
type Particle = {
  id: number;
  emoji: string;
  left: number;
  delay: number;
  duration: number;
  size: number;
};

export function useVenueFx(venueName: string) {
  const [banner, setBanner] = useState<Banner | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [rain, setRain] = useState<Particle[]>([]);
  const idRef = useRef(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((id) => window.clearTimeout(id));
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const push = useCallback(
    (action: VenueAction, name: string) => {
      idRef.current += 1;
      const id = idRef.current;

      const text = action.announce
        .replace("{name}", `@${name}`)
        .replace("{venue}", venueName);
      setFeed((current) => [...current.slice(-2), { id, text }]);
      later(() => setFeed((current) => current.filter((item) => item.id !== id)), 6500);

      if (action.banner) {
        setBanner({ id, kind: action.banner, name, venue: venueName });
        later(() => setBanner((current) => (current?.id === id ? null : current)), 4300);
      }

      if (action.fx.count > 0 && action.fx.emoji.length > 0) {
        const particles: Particle[] = Array.from({ length: action.fx.count }, (_, index) => ({
          id: id * 1000 + index,
          emoji: action.fx.emoji[index % action.fx.emoji.length],
          left: Math.random() * 100,
          delay: Math.random() * 1.2,
          duration: 2.4 + Math.random() * 1.8,
          size: 20 + Math.random() * 16,
        }));
        setRain((current) => [...current, ...particles]);
        later(
          () => setRain((current) => current.filter((p) => Math.floor(p.id / 1000) !== id)),
          5200,
        );
      }
    },
    [venueName, later],
  );

  return { banner, feed, rain, push };
}

export type VenueFx = ReturnType<typeof useVenueFx>;

export function VenueFxLayer({ fx }: { fx: VenueFx }) {
  const { banner, feed, rain } = fx;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      <style>{`
        @keyframes venue-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 0; }
          8% { opacity: 1; }
          100% { transform: translateY(118vh) rotate(380deg); opacity: 1; }
        }
        @keyframes venue-pop {
          0% { transform: translateX(-50%) scale(0.6); opacity: 0; }
          60% { transform: translateX(-50%) scale(1.06); opacity: 1; }
          100% { transform: translateX(-50%) scale(1); opacity: 1; }
        }
        @keyframes venue-slide {
          0% { transform: translateY(-8px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      {rain.map((particle) => (
        <span
          key={particle.id}
          style={{
            position: "absolute",
            top: "-8%",
            left: `${particle.left}%`,
            fontSize: particle.size,
            lineHeight: 1,
            animation: `venue-fall ${particle.duration}s linear ${particle.delay}s both`,
          }}
        >
          {particle.emoji}
        </span>
      ))}

      <div className="absolute inset-x-0 top-[calc(env(safe-area-inset-top)+10.25rem)] flex flex-col items-center gap-1.5 px-3">
        {feed.map((item) => (
          <p
            key={item.id}
            className="max-w-full rounded-full border border-white/15 bg-[#0c1320]/85 px-4 py-2 text-center text-[11px] font-bold text-[#ffd34d] shadow-lg backdrop-blur"
            style={{ animation: "venue-slide 0.25s ease-out" }}
          >
            {item.text}
          </p>
        ))}
      </div>

      {banner && (banner.kind === "hype" || banner.kind === "dj") && (
        <div
          key={banner.id}
          className="absolute left-1/2 top-[30%] w-[min(22rem,calc(100%-2rem))] rounded-3xl border-2 border-[#ff2d8f] bg-[#1a0a24]/95 px-5 py-4 text-center shadow-[0_0_40px_rgba(255,45,143,0.45)]"
          style={{ animation: "venue-pop 0.35s ease-out both" }}
        >
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#ff2d8f]">
            {banner.kind === "dj" ? "🎧 The DJ" : "🎤 The Hype Man"}
          </p>
          <p className="mt-1 text-2xl font-black uppercase leading-tight text-white">
            {banner.kind === "dj" ? "Shout-out to" : "Make some noise for"}
          </p>
          <p className="break-all text-2xl font-black text-[#ffd34d]">@{banner.name}!!!</p>
          <p className="mt-1 text-xs font-semibold text-white/75">
            {banner.kind === "dj" ? "Turn it up!" : "Odogwu don land!"}
          </p>
        </div>
      )}

      {banner && banner.kind === "owns" && (
        <div
          key={banner.id}
          className="absolute left-1/2 top-[26%] w-[calc(100%-2rem)] -translate-x-1/2 text-center font-black uppercase leading-[1.05] text-[#ffd34d]"
          style={{
            fontSize: "clamp(1.7rem, 8vw, 3rem)",
            textShadow: "0 3px 0 #8a5a00, 0 0 24px rgba(255,211,77,0.6)",
            animation: "venue-pop 0.4s ease-out both",
          }}
        >
          <span className="break-all">@{banner.name}</span>
          <br />
          owns {banner.venue}
          <br />
          tonight
        </div>
      )}
    </div>
  );
}