// Admin-side client for the coding submissions backend.
// Mirrors the row shape from learner submission-store.ts; admins additionally
// see other learners' rows.

import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';

const ENDPOINT = `${BASE_URL}/admin-core-service/coding/submissions`;

export type Verdict = 'ACCEPTED' | 'PARTIAL' | 'REJECTED' | 'ERROR' | 'TIMED_OUT';

export interface AdminSubmissionSummary {
    id: string;
    slideId: string;
    learnerId: string;
    language: string;
    verdict: Verdict;
    passedCount: number;
    totalCount: number;
    score: number;
    maxPoints: number;
    totalTimeMs: number;
    peakMemoryKb: number;
    submittedAt: string | number;
}

export interface AdminTestCaseResult {
    id: string;
    label?: string;
    visible: boolean;
    passed: boolean;
    stdout: string;
    expected: string;
    // Which accepted output matched (-1 = none), and how many were accepted, so
    // the report can show "accepts N outputs — matched #X". Optional: older
    // submissions predate these fields.
    matchedIndex?: number;
    acceptedCount?: number;
    stderr?: string;
    timeMs?: number;
    memoryKb?: number;
    error?: string;
}

export interface AdminSubmissionDetail extends AdminSubmissionSummary {
    sourceCode: string;
    testcaseResultsJson?: string | null;
    sessionStartedAt?: string | number | null;
    packageSessionId?: string | null;
    // Parsed in-place for UI convenience.
    results: AdminTestCaseResult[];
}

interface SpringPage<T> {
    content: T[];
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
}

export async function listSubmissionsForSlide(
    slideId: string,
    opts: { page?: number; size?: number; learnerId?: string } = {}
): Promise<SpringPage<AdminSubmissionSummary>> {
    const params: Record<string, string | number> = {
        slideId,
        page: opts.page ?? 0,
        size: opts.size ?? 20,
    };
    if (opts.learnerId) params.learnerId = opts.learnerId;
    const res = await authenticatedAxiosInstance.get<SpringPage<AdminSubmissionSummary>>(ENDPOINT, {
        params,
    });
    return res.data;
}

export async function getSubmissionDetail(id: string): Promise<AdminSubmissionDetail> {
    const res = await authenticatedAxiosInstance.get(`${ENDPOINT}/${id}`);
    const row = res.data as Omit<AdminSubmissionDetail, 'results'>;
    let results: AdminTestCaseResult[] = [];
    if (row.testcaseResultsJson) {
        try {
            const parsed = JSON.parse(row.testcaseResultsJson);
            if (Array.isArray(parsed)) results = parsed as AdminTestCaseResult[];
        } catch {
            // ignore — leave results empty
        }
    }
    return { ...row, results };
}
