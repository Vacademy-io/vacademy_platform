import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { SLIDE_INTERACTION } from "@/constants/urls";

// One stored block of learner interaction within a document slide.
// `state` is the parsed, frontend-defined payload (shape depends on type).
export interface SlideInteraction {
  elementKey: string; // e.g. "checklist", "fill-2", "mcq-0"
  elementType: string; // CHECKLIST | FILL_BLANKS | MCQ
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state: any;
}

/**
 * Load all of the current learner's interaction blocks for a document slide,
 * keyed by elementKey. Never throws — interactivity is a nice-to-have, so any
 * failure resolves to an empty map and leaves the slide working.
 */
export const getSlideInteractions = async (
  slideId: string
): Promise<Map<string, SlideInteraction>> => {
  const map = new Map<string, SlideInteraction>();
  try {
    const res = await authenticatedAxiosInstance.get(
      `${SLIDE_INTERACTION}?slideId=${encodeURIComponent(slideId)}`
    );
    const rows: Array<{ elementKey: string; elementType: string; stateJson?: string | null }> =
      Array.isArray(res?.data) ? res.data : [];
    for (const r of rows) {
      if (!r?.elementKey) continue;
      let state: unknown = null;
      try {
        state = r.stateJson ? JSON.parse(r.stateJson) : null;
      } catch {
        state = null;
      }
      map.set(r.elementKey, { elementKey: r.elementKey, elementType: r.elementType, state });
    }
  } catch {
    // ignore — return whatever we have (possibly empty)
  }
  return map;
};

/**
 * Upsert one interaction block for the current learner on a document slide.
 * Best-effort; swallows errors so a failed save never disrupts the slide.
 */
export const saveSlideInteraction = async (
  slideId: string,
  elementKey: string,
  elementType: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state: any
): Promise<void> => {
  try {
    await authenticatedAxiosInstance.post(
      `${SLIDE_INTERACTION}?slideId=${encodeURIComponent(slideId)}`,
      { elementKey, elementType, stateJson: JSON.stringify(state) }
    );
  } catch {
    // ignore — best-effort persistence
  }
};
