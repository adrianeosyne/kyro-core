import { useEffect, useState } from "react";

/**
 * A render-safe "current time". `Date.now()` must not be called during render
 * (it is impure), so components that show timestamps read this ticking value
 * instead. It starts at 0 until the first tick scheduled from the commit
 * phase; render code treats 0 as "not known yet".
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(0);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    // Defer the first read so the effect body stays free of synchronous state
    // updates; a zero-delay timer keeps the first paint correct within a frame.
    const initial = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, intervalMs);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [intervalMs]);

  return now;
}
