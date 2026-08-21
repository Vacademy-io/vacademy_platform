import { useEffect, useState } from "react";

const MINUTE_MS = 60 * 1000;

/** Current time truncated to the minute — unlocks are never finer-grained. */
const currentMinute = () => Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS;

/**
 * A clock that ticks only while something is actually waiting on it.
 *
 * Drip evaluation reads the wall clock, but nothing in React re-renders when
 * the clock passes an unlock time — so a learner sitting on the course page at
 * 23:59 would still see tomorrow's chapter locked at 00:01, until they
 * navigated away and back. This gives those evaluations a value that changes
 * once a minute so the card flips on its own.
 *
 * Returns a fixed value when inactive, so a course with no time-based rule
 * re-renders exactly as often as it did before.
 */
export function useDripClock(active: boolean): number {
  const [minute, setMinute] = useState(() => currentMinute());

  useEffect(() => {
    if (!active) return;

    const sync = () => setMinute((prev) => {
      const next = currentMinute();
      return next === prev ? prev : next;
    });

    sync();
    const timer = window.setInterval(sync, MINUTE_MS);

    // Timers are throttled or suspended while the app is backgrounded, which
    // on mobile is most of the time. Re-syncing on the way back in is what
    // actually makes an overnight unlock appear.
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
    };
  }, [active]);

  return active ? minute : 0;
}
