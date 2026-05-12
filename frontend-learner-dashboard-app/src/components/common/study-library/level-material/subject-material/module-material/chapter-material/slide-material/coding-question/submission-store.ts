// Backend-backed submission store. Phase 4 introduced the API; this module
// is the single seam — call sites in QuestionModeView/SubmissionHistory don't
// change.
//
// Endpoints (admin_core_service):
//   POST /admin-core-service/coding/submissions
//   GET  /admin-core-service/coding/submissions?slideId=...&page=...&size=...
//
// Shape mapping:
//   Backend:  testcase_results_json (string)  ⇄  Learner: results: TestCaseResult[]
//   Backend:  submitted_at (ISO/epoch string) ⇄  Learner: submittedAt: number
//
// Falls back to a local in-memory cache if the network call fails so the UI
// still surfaces the most-recent attempt during a flaky connection.

import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { CODING_SUBMISSIONS } from "@/constants/urls";
import type {
  CodingSubmission,
  LangId,
  TestCaseResult,
  Verdict,
} from "./types";

const ENDPOINT = CODING_SUBMISSIONS;

// In-flight cache so an offline Submit isn't lost from the UI before the next
// listSubmissions() call. Keyed by slideId.
const localCache = new Map<string, CodingSubmission[]>();

interface BackendRow {
  id: string;
  slideId: string;
  learnerId: string;
  packageSessionId?: string | null;
  language: string;
  sourceCode?: string;
  verdict: string;
  passedCount: number;
  totalCount: number;
  score: number;
  maxPoints: number;
  testcaseResultsJson?: string | null;
  totalTimeMs: number;
  peakMemoryKb: number;
  submittedAt: string | number;
  sessionStartedAt?: string | number | null;
}

function parseDate(v: string | number | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : 0;
}

function parseResults(json: string | null | undefined): TestCaseResult[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as TestCaseResult[]) : [];
  } catch {
    return [];
  }
}

function fromBackend(row: BackendRow): CodingSubmission {
  return {
    id: row.id,
    slideId: row.slideId,
    language: row.language as LangId,
    sourceCode: row.sourceCode ?? "",
    verdict: row.verdict as Verdict,
    passedCount: row.passedCount,
    totalCount: row.totalCount,
    score: row.score,
    maxPoints: row.maxPoints,
    results: parseResults(row.testcaseResultsJson),
    totalTimeMs: row.totalTimeMs,
    peakMemoryKb: row.peakMemoryKb,
    submittedAt: parseDate(row.submittedAt),
    sessionStartedAt:
      row.sessionStartedAt != null ? parseDate(row.sessionStartedAt) : undefined,
  };
}

export async function listSubmissions(
  slideId: string,
): Promise<CodingSubmission[]> {
  if (!slideId) return [];
  try {
    // The list endpoint returns a Spring Page; we only need .content for now.
    // Single page of 50 covers the typical history view comfortably.
    const res = await authenticatedAxiosInstance.get(ENDPOINT, {
      params: { slideId, page: 0, size: 50 },
    });
    const content: BackendRow[] = res.data?.content ?? [];
    // Summary endpoint omits source_code + testcase_results_json — fine for
    // the list. The detail endpoint hydrates them when a row is expanded.
    const rows = content.map(fromBackend);
    localCache.set(slideId, rows);
    return rows;
  } catch (e) {
    console.error("[coding] listSubmissions failed", e);
    return localCache.get(slideId) ?? [];
  }
}

/**
 * Hydrate a single submission with its full source_code and testcase results.
 * Use this when the list view expands a row to show details.
 */
export async function getSubmission(
  id: string,
): Promise<CodingSubmission | null> {
  if (!id) return null;
  try {
    const res = await authenticatedAxiosInstance.get(`${ENDPOINT}/${id}`);
    return fromBackend(res.data as BackendRow);
  } catch (e) {
    console.error("[coding] getSubmission failed", e);
    return null;
  }
}

// Cascade-context IDs that the backend needs in order to fire the
// learner_operation cascade (slide → chapter → module → subject →
// package_session). Callers pull these from the router search params so the
// submission contributes to progress rollups. If any is missing, the backend
// still saves the submission but skips the cascade (logged on the server).
export interface CascadeContext {
  chapterId: string;
  moduleId: string;
  subjectId: string;
  packageSessionId: string;
}

export async function saveSubmission(
  submission: CodingSubmission,
  cascade?: CascadeContext,
): Promise<void> {
  // learnerId is set server-side from the JWT — we don't send it.
  const payload = {
    slideId: submission.slideId,
    language: submission.language,
    sourceCode: submission.sourceCode,
    verdict: submission.verdict,
    passedCount: submission.passedCount,
    totalCount: submission.totalCount,
    score: submission.score,
    maxPoints: submission.maxPoints,
    testcaseResultsJson: JSON.stringify(submission.results ?? []),
    totalTimeMs: submission.totalTimeMs,
    peakMemoryKb: submission.peakMemoryKb,
    sessionStartedAt: submission.sessionStartedAt
      ? new Date(submission.sessionStartedAt).toISOString()
      : null,
    chapterId: cascade?.chapterId,
    moduleId: cascade?.moduleId,
    subjectId: cascade?.subjectId,
    packageSessionId: cascade?.packageSessionId,
  };

  try {
    const res = await authenticatedAxiosInstance.post(ENDPOINT, payload);
    // Refresh cache with the persisted row so the next listSubmissions sees it
    // immediately even if the GET is still in flight elsewhere.
    const persisted = fromBackend(res.data as BackendRow);
    const existing = localCache.get(submission.slideId) ?? [];
    localCache.set(submission.slideId, [persisted, ...existing].slice(0, 50));
  } catch (e) {
    console.error("[coding] saveSubmission failed", e);
    // Surface a stub locally so the UI still shows what just happened.
    const existing = localCache.get(submission.slideId) ?? [];
    localCache.set(submission.slideId, [submission, ...existing].slice(0, 50));
    throw e;
  }
}

export async function bestSubmission(
  slideId: string,
): Promise<CodingSubmission | null> {
  const list = await listSubmissions(slideId);
  if (!list.length) return null;
  return list.reduce((best, s) => (s.score > best.score ? s : best), list[0]!);
}
