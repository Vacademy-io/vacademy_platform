import { useEffect, useState } from "react";

/**
 * Re-render on an interval so countdowns and time-window gates stay current
 * without a page refresh — e.g. an assessment slide flipping from "Opens in
 * 2 min" to startable.
 *
 * @param enabled ticking is opt-in; leave it false when nothing on screen
 *                depends on the clock so idle screens stay idle.
 */
export function useNow(enabled: boolean, intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;
    // Re-sync immediately so a screen that starts ticking doesn't carry a stale
    // timestamp until the first interval fires.
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, intervalMs]);

  return now;
}
