/**
 * Options channel between the course-grid block(s) and the page-level Course
 * Finder wizard. The two live in different trees (the wizard sits outside
 * JsonRenderer), so they can't pass props — see CourseCatalogComponent.
 *
 * Why this exists rather than a bare window event: React runs child effects
 * before parent effects, so whenever the grid already has its courses at mount
 * time (warm react-query cache, client-side navigation back to the catalogue)
 * it publishes *before* CourseCataloguePage has subscribed, and a plain
 * dispatch is lost with no second chance — the wizard then never opens. So the
 * last payload is retained here and a late subscriber gets it immediately.
 */

export interface CourseFinderOption {
  id: string;
  name: string;
}

export interface CourseFinderOptionsPayload {
  levels: CourseFinderOption[];
  sessions: CourseFinderOption[];
  tags: CourseFinderOption[];
}

const EVENT_NAME = "courseFinderOptionsReady";

/**
 * Last published payload, replayed to subscribers that arrive late. Cleared
 * when the publishing grid unmounts so a different catalogue page can never
 * inherit the previous one's levels.
 */
let latest: CourseFinderOptionsPayload | null = null;

export const publishCourseFinderOptions = (payload: CourseFinderOptionsPayload): void => {
  latest = payload;
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: payload }));
};

export const getLatestCourseFinderOptions = (): CourseFinderOptionsPayload | null => latest;

export const clearCourseFinderOptions = (): void => {
  latest = null;
};

/** Subscribes to later publishes. Returns the unsubscribe function. */
export const subscribeCourseFinderOptions = (
  onOptions: (payload: CourseFinderOptionsPayload) => void,
): (() => void) => {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail || {};
    onOptions({
      levels: Array.isArray(detail.levels) ? detail.levels : [],
      sessions: Array.isArray(detail.sessions) ? detail.sessions : [],
      tags: Array.isArray(detail.tags) ? detail.tags : [],
    });
  };
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
};

// ─── The visitor's answer, travelling back the other way ─────────────────────

const APPLIED_EVENT_NAME = "courseFinderApplied";

export interface CourseFinderSelectionPayload {
  /** Raw level names, already expanded from any levelGroups label. */
  levels: string[];
  sessions: string[];
  tags: string[];
  /**
   * What the visitor actually SAW themselves pick — group labels ("Class 6"),
   * not the raw values those expand to ("Cyber AI- Class 6", "English - Class
   * 6", …). Course blocks echo these back as removable chips; showing the
   * expanded `levels` there would print five near-identical rows for one tap.
   * Optional so an older dispatcher (or a hand-fired event) still type-checks.
   */
  labels?: string[];
}

/**
 * Subscribes to the wizard's picks. Unlike the options channel this is not
 * replayed: the wizard is rendered by the page and always mounts before the
 * visitor can answer, so no subscriber can miss the event.
 */
export const subscribeCourseFinderApplied = (
  onApplied: (selection: CourseFinderSelectionPayload) => void,
): (() => void) => {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail || {};
    onApplied({
      levels: Array.isArray(detail.levels) ? detail.levels : [],
      sessions: Array.isArray(detail.sessions) ? detail.sessions : [],
      tags: Array.isArray(detail.tags) ? detail.tags : [],
      // Fall back to the raw values so a dispatcher that never sets labels
      // still gives the chips something truthful to render.
      labels: Array.isArray(detail.labels)
        ? detail.labels
        : [
            ...(Array.isArray(detail.levels) ? detail.levels : []),
            ...(Array.isArray(detail.sessions) ? detail.sessions : []),
            ...(Array.isArray(detail.tags) ? detail.tags : []),
          ],
    });
  };
  window.addEventListener(APPLIED_EVENT_NAME, handler);
  return () => window.removeEventListener(APPLIED_EVENT_NAME, handler);
};
