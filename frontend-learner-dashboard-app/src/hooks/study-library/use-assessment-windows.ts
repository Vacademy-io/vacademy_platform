import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchAssessmentData } from "@/routes/assessment/examination/-utils.ts/useFetchAssessment";
import { Assessment, assessmentTypes } from "@/types/assessment";
import {
  AssessmentWindow,
  getAssessmentWindow,
} from "@/utils/assessment-window";

/**
 * The learner's own assessments, keyed by assessment id.
 *
 * Assessment slides carry only an `assessment_id` — the schedule
 * (bound_start_time / bound_end_time) lives in assessment_service, which sits on
 * a separate database, so it cannot ride along on the slide payload. The
 * learner's three assessment lists already carry it, so we pull them once and
 * index them. One fixed query key means every slide in the course shares a
 * single cached fetch instead of re-scanning the buckets per slide.
 */
export type AssessmentDirectory = Map<string, Assessment>;

const BUCKET_PRIORITY: assessmentTypes[] = [
  assessmentTypes.LIVE,
  assessmentTypes.UPCOMING,
  assessmentTypes.PAST,
];

const DIRECTORY_PAGE_SIZE = 100;

export const fetchAssessmentDirectory =
  async (): Promise<AssessmentDirectory> => {
    const settled = await Promise.all(
      BUCKET_PRIORITY.map(async (bucket) => {
        try {
          const response = await fetchAssessmentData(
            0,
            DIRECTORY_PAGE_SIZE,
            bucket,
            "ASSESSMENT"
          );
          return { ok: true, rows: (response?.content ?? []) as Assessment[] };
        } catch {
          // A single failing bucket must not blank out the others — a slide
          // whose assessment lives in a healthy bucket should still resolve.
          return { ok: false, rows: [] as Assessment[] };
        }
      })
    );

    // Every bucket failing is a real error, not "you have no assessments" —
    // surface it so the slide can say it couldn't load instead of silently
    // rendering as if the assessment doesn't exist.
    if (settled.every((bucket) => !bucket.ok)) {
      throw new Error("Could not load the learner's assessments");
    }

    const responses = settled.map((bucket) => bucket.rows);
    const directory: AssessmentDirectory = new Map();
    // Buckets are merged in LIVE → UPCOMING → PAST order and never overwritten,
    // matching the precedence the slide viewer used when it scanned them in turn.
    responses.flat().forEach((assessment) => {
      if (assessment?.assessment_id && !directory.has(assessment.assessment_id)) {
        directory.set(assessment.assessment_id, assessment);
      }
    });
    return directory;
  };

export const ASSESSMENT_DIRECTORY_QUERY_KEY = ["LEARNER_ASSESSMENT_DIRECTORY"];

/**
 * @param enabled pass false when the caller has no assessment slides to resolve,
 *                so ordinary chapters never pay for the three list calls.
 */
export function useAssessmentDirectory(enabled = true) {
  return useQuery<AssessmentDirectory>({
    queryKey: ASSESSMENT_DIRECTORY_QUERY_KEY,
    queryFn: fetchAssessmentDirectory,
    enabled,
    staleTime: 60 * 1000,
  });
}

/**
 * Availability window per assessment id, for callers that need to gate several
 * slides at once (the chapter sidebar). `nowMs` is threaded in so a ticking
 * caller re-derives the state as a window opens or closes.
 */
export function useAssessmentWindows(
  assessmentIds: string[],
  nowMs: number
): Record<string, AssessmentWindow> {
  const { data: directory } = useAssessmentDirectory(assessmentIds.length > 0);
  // Key on the ids themselves, not the array identity — callers rebuild the
  // array on every render.
  const idKey = assessmentIds.join(",");

  return useMemo(() => {
    if (!directory) return {};
    const windows: Record<string, AssessmentWindow> = {};
    idKey
      .split(",")
      .filter(Boolean)
      .forEach((id) => {
        const assessment = directory.get(id);
        if (assessment) windows[id] = getAssessmentWindow(assessment, nowMs);
      });
    return windows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directory, idKey, nowMs]);
}
