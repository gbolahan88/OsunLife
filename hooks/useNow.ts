"use client";

import { useEffect, useState } from "react";

// Returns the current time in milliseconds and refreshes it on an interval.
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(0);

  useEffect(() => {
    const initialUpdate = setTimeout(() => setNow(Date.now()), 0);
    const interval = setInterval(() => setNow(Date.now()), intervalMs);
    return () => {
      clearTimeout(initialUpdate);
      clearInterval(interval);
    };
  }, [intervalMs]);

  return now;
}