/**
 * Availability window helpers for an assessment (bound_start_time →
 * bound_end_time).
 *
 * The same window drives three surfaces: the assessment tab cards, an
 * assessment slide inside a course, and that slide's sidebar entry. Keeping the
 * parsing and the open/closed state machine here is what stops them drifting
 * apart — the tab used to honour the window while the slide ignored it, so a
 * scheduled assessment was startable from the course before it opened.
 *
 * These are UI gates only. The real gate is assessment_service, which rejects a
 * start outside the window; this just stops the learner walking into that error.
 */

/** Sentinel "never closes" end date written by the backend when no end is set. */
export const NO_EXPIRY_YEAR = 9999;

/**
 * Backend date strings (assessment list API) have no timezone marker but are
 * stored in UTC. Appending "Z" makes Date() interpret them as UTC so the
 * canonical formatters render them in the user's local timezone.
 */
export function toUtcDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const hasZone = /Z$|[+-]\d{2}:?\d{2}$/i.test(raw);
  const iso = hasZone ? raw : `${raw.replace(" ", "T")}Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * True for the backend's "never closes" sentinel end date.
 *
 * Compared in UTC, and as ">=" rather than "==": the sentinel is written as
 * 9999-12-31T23:59:59.999Z, so in any timezone ahead of UTC the LOCAL year rolls
 * over to 10000 and an equality check on getFullYear() misses it — which in IST
 * made an "always available" assessment advertise a closing date of Jan 1, 10000.
 */
export function hasNoExpiry(end: Date | null): boolean {
  return !!end && end.getUTCFullYear() >= NO_EXPIRY_YEAR;
}

export type AssessmentWindowState = "NOT_STARTED" | "OPEN" | "CLOSED";

export interface AssessmentWindow {
  start: Date | null;
  end: Date | null;
  /** End date is the "never closes" sentinel (or absent). */
  noExpiry: boolean;
  state: AssessmentWindowState;
  /** Milliseconds until the window opens; null once open or with no start. */
  msToStart: number | null;
  /** Milliseconds until the window closes; null when it never closes. */
  msToEnd: number | null;
}

interface WindowSource {
  bound_start_time?: string | null;
  bound_end_time?: string | null;
}

/**
 * Resolve where `now` sits relative to the assessment's window.
 *
 * A missing start means "open from the beginning"; a missing or sentinel end
 * means "never closes". Both are normal — an assessment created without a date
 * range gets start = creation time and end = the 9999 sentinel.
 */
export function getAssessmentWindow(
  source: WindowSource | null | undefined,
  now: number = Date.now()
): AssessmentWindow {
  const start = toUtcDate(source?.bound_start_time);
  const end = toUtcDate(source?.bound_end_time);
  const noExpiry = !end || hasNoExpiry(end);

  const msToStart = start ? start.getTime() - now : null;
  const msToEnd = end && !noExpiry ? end.getTime() - now : null;

  let state: AssessmentWindowState = "OPEN";
  if (msToStart !== null && msToStart > 0) {
    state = "NOT_STARTED";
  } else if (msToEnd !== null && msToEnd <= 0) {
    state = "CLOSED";
  }

  return { start, end, noExpiry, state, msToStart, msToEnd };
}

/** Convenience: the learner may only begin/resume an attempt while OPEN. */
export function isWindowOpen(window: AssessmentWindow): boolean {
  return window.state === "OPEN";
}
