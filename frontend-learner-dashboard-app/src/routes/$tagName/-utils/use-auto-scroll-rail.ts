import { useEffect, useRef, type RefObject } from "react";

/** Fastest an authored rail may advance; quicker than this nobody can read a card. */
export const AUTO_SCROLL_MIN_MS = 1500;
export const AUTO_SCROLL_DEFAULT_MS = 3000;

export const resolveAutoScrollInterval = (raw: unknown): number => {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.max(AUTO_SCROLL_MIN_MS, Math.round(n)) : AUTO_SCROLL_DEFAULT_MS;
};

/**
 * Advances a horizontal scroll rail (an `overflow-x-auto` flex row of cards)
 * by one card every `intervalMs`, and wraps back to the first card at the end.
 *
 * It only moves the rail's own scroll position, so swipe, the arrows and
 * snap points keep working as before. It holds still while the visitor is
 * using the rail (hover, keyboard focus, a touch in the last few seconds),
 * while the rail is off screen or the tab is hidden, and under
 * prefers-reduced-motion — an advert that keeps moving under a reader's
 * finger is worse than none.
 */
export const useAutoScrollRail = (
  trackRef: RefObject<HTMLElement | null>,
  {
    enabled,
    intervalMs,
    itemCount = 0,
  }: {
    enabled: boolean;
    intervalMs?: number;
    /** Re-attach when the cards change — the rail often mounts after its data loads. */
    itemCount?: number;
  }
) => {
  const hovered = useRef(false);
  const focused = useRef(false);
  const touchedAt = useRef(0);
  const onScreen = useRef(true);

  useEffect(() => {
    const el = trackRef.current;
    if (!enabled || !el || typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const enter = () => (hovered.current = true);
    const leave = () => (hovered.current = false);
    const focusIn = () => (focused.current = true);
    const focusOut = (e: FocusEvent) => {
      if (!el.contains(e.relatedTarget as Node | null)) focused.current = false;
    };
    const touch = () => (touchedAt.current = Date.now());
    el.addEventListener("mouseenter", enter);
    el.addEventListener("mouseleave", leave);
    el.addEventListener("focusin", focusIn);
    el.addEventListener("focusout", focusOut);
    el.addEventListener("touchstart", touch, { passive: true });
    el.addEventListener("wheel", touch, { passive: true });

    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(([entry]) => (onScreen.current = !!entry?.isIntersecting), { threshold: 0.25 })
        : null;
    io?.observe(el);

    const tick = () => {
      if (hovered.current || focused.current || !onScreen.current || document.hidden) return;
      if (Date.now() - touchedAt.current < 4000) return;
      if (el.scrollWidth - el.clientWidth < 8) return; // everything already fits
      const first = el.firstElementChild as HTMLElement | null;
      const second = first?.nextElementSibling as HTMLElement | null;
      // One card = the distance between two neighbouring cards (width + gap).
      const step = first && second ? second.offsetLeft - first.offsetLeft : el.clientWidth;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8;
      if (atEnd) el.scrollTo({ left: 0, behavior: "smooth" });
      else el.scrollBy({ left: step, behavior: "smooth" });
    };
    const timer = window.setInterval(tick, resolveAutoScrollInterval(intervalMs));

    return () => {
      window.clearInterval(timer);
      io?.disconnect();
      el.removeEventListener("mouseenter", enter);
      el.removeEventListener("mouseleave", leave);
      el.removeEventListener("focusin", focusIn);
      el.removeEventListener("focusout", focusOut);
      el.removeEventListener("touchstart", touch);
      el.removeEventListener("wheel", touch);
    };
  }, [trackRef, enabled, intervalMs, itemCount]);
};
