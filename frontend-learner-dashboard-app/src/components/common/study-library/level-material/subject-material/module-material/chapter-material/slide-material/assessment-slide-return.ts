import { Storage } from "@capacitor/storage";
import { v4 as uuidv4 } from "uuid";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import {
  SUBMIT_QUIZ_SLIDE_ACTIVITY_LOG,
  SUBMIT_ASSESSMENT_SLIDE_ACTIVITY_LOG,
} from "@/constants/urls";

const SLIDE_RETURN_KEY = "SLIDE_RETURN_CONTEXT";

// Stale-context guard. Anything older than 24h is almost certainly a leftover
// from an unrelated tab and should be discarded so we don't stomp the normal
// post-submit redirect.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface SlideReturnContext {
  returnSlideId: string;
  returnPathname: string;
  returnSearch: string;
  startedAt: number;
}

export const readSlideReturnContext =
  async (): Promise<SlideReturnContext | null> => {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(SLIDE_RETURN_KEY);
    } catch {
      // ignore
    }
    if (!raw) {
      try {
        const fallback = await Storage.get({ key: SLIDE_RETURN_KEY });
        raw = fallback.value ?? null;
      } catch {
        raw = null;
      }
    }
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as SlideReturnContext;
      if (
        !parsed?.returnSlideId ||
        !parsed?.returnPathname ||
        typeof parsed.startedAt !== "number"
      ) {
        return null;
      }
      if (Date.now() - parsed.startedAt > MAX_AGE_MS) {
        await clearSlideReturnContext();
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  };

export const clearSlideReturnContext = async () => {
  try {
    sessionStorage.removeItem(SLIDE_RETURN_KEY);
  } catch {
    // ignore
  }
  try {
    await Storage.remove({ key: SLIDE_RETURN_KEY });
  } catch {
    // ignore
  }
};

/**
 * Mark the originating assessment-slide as 100% complete. Mirrors what the
 * quiz slide does on submission. Failures are non-fatal — re-visiting the
 * slide will re-fetch live status from assessment_service so progress will
 * reconcile on next view either way.
 */
export const markAssessmentSlideComplete = async (
  slideId: string,
  attemptId: string,
  // For manual assessments: the learner's uploaded answer file id(s). Recorded
  // on the assessment-slide activity log so the submission (learner + attempt +
  // answer file) is tracked the same way assignment submissions are.
  fileIds?: string,
  // Hierarchy context (chapter/module/subject/package_session) so the backend
  // can cascade the slide-level completion into the chapter/module/subject/
  // course progress rollups. Optional — the slide-level 100% write (which is
  // what prerequisite/drip checks read) still happens without them.
  hierarchy?: {
    chapterId?: string;
    moduleId?: string;
    subjectId?: string;
    packageSessionId?: string;
  },
) => {
  const params = new URLSearchParams({ slideId });
  const activityLogParams = new URLSearchParams({ slideId });
  if (hierarchy?.chapterId) activityLogParams.set("chapterId", hierarchy.chapterId);
  if (hierarchy?.moduleId) activityLogParams.set("moduleId", hierarchy.moduleId);
  if (hierarchy?.subjectId) activityLogParams.set("subjectId", hierarchy.subjectId);
  if (hierarchy?.packageSessionId)
    activityLogParams.set("packageSessionId", hierarchy.packageSessionId);

  // 1) Mark the slide complete (progress). Best-effort — re-visiting the slide
  //    re-fetches live status from assessment_service so progress reconciles.
  try {
    await authenticatedAxiosInstance.post(
      `${SUBMIT_QUIZ_SLIDE_ACTIVITY_LOG}?${params.toString()}`,
      {
        slide_id: slideId,
        source_type: "ASSESSMENT",
        attempt_id: attemptId,
        percentage_completed: 100,
        status: "COMPLETED",
      },
    );
  } catch (err) {
    console.warn("Failed to mark assessment slide complete:", err);
  }

  // 2) Record the submission on the assessment-slide activity log (learner +
  //    attempt + answer file), which is also what marks the SLIDE-level
  //    progress operation as 100% complete server-side. Separate from (1) so
  //    a failure in either can't take down the other.
  try {
    await authenticatedAxiosInstance.post(
      `${SUBMIT_ASSESSMENT_SLIDE_ACTIVITY_LOG}?${activityLogParams.toString()}`,
      {
        id: uuidv4(),
        slide_id: slideId,
        source_type: "ASSESSMENT",
        percentage_watched: 100,
        new_activity: true,
        assessment_slides: [
          {
            id: uuidv4(),
            attempt_id: attemptId,
            comma_separated_file_ids: fileIds ?? "",
          },
        ],
      },
    );
  } catch (err) {
    console.warn("Failed to record assessment slide submission:", err);
  }
};

/**
 * Build a TanStack Router-compatible URL string for navigating back to the
 * slide. We round-trip the captured pathname + search params verbatim, then
 * append `slideId` (overwriting anything stale) and a one-shot
 * `justSubmittedAssessment` flag.
 */
export const buildSlideReturnUrl = (ctx: SlideReturnContext): string => {
  const search = new URLSearchParams(ctx.returnSearch);
  search.set("slideId", ctx.returnSlideId);
  search.set("justSubmittedAssessment", "1");
  const qs = search.toString();
  return qs ? `${ctx.returnPathname}?${qs}` : ctx.returnPathname;
};
