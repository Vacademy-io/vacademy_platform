// Bringing the row a learner is on into view, shared by the sidebar modes.
//
// Two things make this harder than `scrollIntoView`:
//   1. `scrollIntoView` walks EVERY scrollable ancestor, which on mobile also
//      drags the page behind the offcanvas sheet. We want the sidebar's own
//      scroller and nothing else.
//   2. The row can mount before the list is tall enough to scroll. The lesson
//      list renders nothing until the course outline arrives, then grows as
//      each section's skeleton and rows land — so a single attempt at mount
//      finds a container with no overflow, silently does nothing, and the
//      learner lands at the top of a 49-lesson list. Hence the retry.

import { useEffect, useRef } from "react";

/** Scroll the row to the middle of its own scroll container.
 *  Returns false when there is no scrollable ancestor yet — the caller's cue
 *  to try again on a later frame. */
export function revealInScrollParent(el: HTMLElement): boolean {
  let parent = el.parentElement;
  while (parent && parent !== document.body) {
    const overflowY = getComputedStyle(parent).overflowY;
    if (
      /(auto|scroll|overlay)/.test(overflowY) &&
      parent.scrollHeight > parent.clientHeight + 1
    ) {
      const parentRect = parent.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const delta =
        elRect.top - parentRect.top - (parent.clientHeight - elRect.height) / 2;
      parent.scrollTop = Math.max(0, parent.scrollTop + delta);
      return true;
    }
    parent = parent.parentElement;
  }
  return false;
}

// ~1s of frames. Long enough for the outline and the current chapter's slides
// to land, short enough that it can't still be fighting a learner who has
// started scrolling.
const MAX_ATTEMPTS = 60;

/** Ref to put on the active row. Reveals it once it becomes active AND the
 *  container is actually scrollable, then stops — it must never re-run and
 *  yank the view back while the learner is scrolling somewhere else. */
export function useRevealWhenActive<T extends HTMLElement>(isActive: boolean) {
  const ref = useRef<T>(null);
  const revealed = useRef(false);

  useEffect(() => {
    if (!isActive) {
      // Navigating away arms it again for the next active row.
      revealed.current = false;
      return;
    }
    if (revealed.current) return;

    let frame = 0;
    let attempts = 0;
    const attempt = () => {
      attempts += 1;
      const el = ref.current;
      if (el && revealInScrollParent(el)) {
        revealed.current = true;
        return;
      }
      if (attempts < MAX_ATTEMPTS) frame = requestAnimationFrame(attempt);
    };
    frame = requestAnimationFrame(attempt);
    return () => cancelAnimationFrame(frame);
  }, [isActive]);

  return ref;
}
