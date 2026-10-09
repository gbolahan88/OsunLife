"use client";

import { motion } from "framer-motion";
import { House, Map, Smartphone, Sofa } from "lucide-react";

export type Tab = "home" | "buy" | "map" | "phone";

const TABS: { id: Tab; label: string; Icon: typeof House }[] = [
  { id: "home", label: "Home", Icon: House },
  { id: "buy", label: "Buy", Icon: Sofa },
  { id: "map", label: "Map", Icon: Map },
  { id: "phone", label: "Phone", Icon: Smartphone },
];

type BottomNavProps = {
  active: Tab;
  onChange: (tab: Tab) => void;
};

export default function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="absolute inset-x-0 bottom-0 z-20 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)]">
      <div className="mx-auto flex max-w-[620px] items-center justify-between rounded-full border border-white/90 bg-white/95 p-1.5 shadow-[0_10px_32px_rgba(24,50,39,0.2)] backdrop-blur-md">
        {TABS.map(({ id, label, Icon }) => {
          const isActive = id === active;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              aria-current={isActive ? "page" : undefined}
              className="relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-full py-1.5 text-xs font-semibold"
            >
              {isActive && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-full bg-[#202838]"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <span
                className={`relative z-10 flex flex-col items-center gap-0.5 ${
                  isActive ? "text-white" : "text-[#727d78]"
                }`}
              >
                <Icon size={20} />
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}