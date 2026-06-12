/**
 * Play-mode celebration moments (slide completion, streak milestones).
 *
 * One shared entry point so every surface celebrates the same way. Confetti
 * colors come from the canonical play palette. Respects prefers-reduced-motion
 * (no-op). Fire-and-forget; safe to call outside play mode (callers gate on
 * usePlayTheme, but a stray call only shows brand-colored confetti).
 */
import confetti from "canvas-confetti";

const PLAY_COLORS = ["#58CC02", "#1CB0F6", "#ffc800", "#CE82FF", "#FF9600"]; // design-lint-ignore: confetti color data (canonical play palette)

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/** Quick burst for a single completion (slide done, badge unlocked). */
export function celebrateCompletion(): void {
  if (reducedMotion()) return;
  confetti({
    particleCount: 80,
    spread: 70,
    startVelocity: 35,
    origin: { y: 0.7 },
    colors: PLAY_COLORS,
    disableForReducedMotion: true,
  });
}

/** Bigger two-sided volley for milestones (chapter complete, streak 7/30…). */
export function celebrateMilestone(): void {
  if (reducedMotion()) return;
  const opts = {
    particleCount: 60,
    spread: 55,
    startVelocity: 45,
    colors: PLAY_COLORS,
    disableForReducedMotion: true,
  };
  confetti({ ...opts, angle: 60, origin: { x: 0, y: 0.7 } });
  confetti({ ...opts, angle: 120, origin: { x: 1, y: 0.7 } });
}

/** Streak milestones worth a volley. */
export function isStreakMilestone(days: number): boolean {
  return days === 3 || days === 7 || days === 14 || days === 30 || (days > 0 && days % 50 === 0);
}

/**
 * Once-per-slide guard so a completion only celebrates the first time
 * (sessionStorage; per-tab is fine for a celebratory moment).
 */
export function shouldCelebrateSlide(slideId: string): boolean {
  if (!slideId) return false;
  const KEY = "vacademy.celebratedSlides.v1";
  try {
    const seen: string[] = JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
    if (seen.includes(slideId)) return false;
    sessionStorage.setItem(KEY, JSON.stringify([...seen.slice(-99), slideId]));
    return true;
  } catch {
    return true;
  }
}
