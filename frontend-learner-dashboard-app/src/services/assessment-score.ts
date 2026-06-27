import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { STUDENT_REPORT_URL } from "@/constants/urls";
import { getUserId } from "@/constants/getUserId";
import { getInstituteId } from "@/constants/helper";
import type { Report } from "@/types/assessments/assessment-data-type";

/**
 * Best assessment score (as a percentage) the learner has achieved across all
 * released attempts. Powers the admin-configurable "assessment_score" badge
 * trigger (e.g. the "Perfect Score" badge). Fetched lazily — only when a badge
 * actually needs it — because the dashboard does not otherwise load report data.
 *
 * The report-list row carries the achieved score in `total_marks`; the maximum
 * possible marks are summed from the per-question `mark` values in `sections`.
 * Rows where the maximum can't be derived are skipped (no false unlock).
 */

const ASSESSMENT_TYPES = ["ASSESSMENT", "HOMEWORK"];
const PAGE_SIZE = 50;

function maxMarksFromSections(report: Report): number {
  const sections = report.sections;
  if (!sections || typeof sections !== "object") return 0;
  let total = 0;
  for (const questions of Object.values(sections)) {
    if (!Array.isArray(questions)) continue;
    for (const q of questions) {
      const mark = Number((q as { mark?: unknown })?.mark);
      if (Number.isFinite(mark)) total += mark;
    }
  }
  return total;
}

function scorePct(report: Report): number | null {
  if (report.report_release_status === "PENDING") return null;
  const achieved = Number(report.total_marks);
  const max = maxMarksFromSections(report);
  if (!Number.isFinite(achieved) || max <= 0) return null;
  return (achieved / max) * 100;
}

/**
 * Returns the highest score percentage (0–100) across the learner's released
 * attempts, or null when no scoreable attempt is found.
 */
export async function fetchBestAssessmentScorePct(): Promise<number | null> {
  try {
    const [studentId, instituteId] = await Promise.all([getUserId(), getInstituteId()]);
    if (!studentId || !instituteId) return null;

    const response = await authenticatedAxiosInstance.post(
      STUDENT_REPORT_URL,
      {
        name: "",
        status: ["ENDED"],
        release_result_status: ["RELEASED"],
        assessment_type: ASSESSMENT_TYPES,
        sort_columns: {},
      },
      { params: { studentId, instituteId, pageNo: 0, pageSize: PAGE_SIZE } }
    );

    const reports: Report[] = response?.data?.content ?? [];
    let best: number | null = null;
    for (const report of reports) {
      const pct = scorePct(report);
      if (pct != null && (best == null || pct > best)) best = pct;
    }
    return best;
  } catch (error) {
    console.error("[assessment-score] failed to compute best score:", error);
    return null;
  }
}
