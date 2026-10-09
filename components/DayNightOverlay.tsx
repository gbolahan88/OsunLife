"use client";

import { motion } from "framer-motion";
import { PHASE_TINT, type DayPhase } from "@/lib/time";

export default function DayNightOverlay({ phase }: { phase: DayPhase }) {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-15"
      initial={false}
      animate={{ backgroundColor: PHASE_TINT[phase] }}
      transition={{ duration: 2.5, ease: "easeInOut" }}
    />
  );
}