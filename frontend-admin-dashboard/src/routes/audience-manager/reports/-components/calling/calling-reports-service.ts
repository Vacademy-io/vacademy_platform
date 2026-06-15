/**
 * Calling tab data layer — the two telephony report endpoints consumed ONLY by
 * the Calling tab of the Reports Center:
 *
 *   GET /admin-core-service/v1/reports/calls-daily
 *   GET /admin-core-service/v1/reports/calls-heatmap
 *
 * NOTE ON OWNERSHIP / DUPLICATION: these fetchers deliberately live inside the
 * calling/ folder instead of the shared ../-services/get-crm-reports.ts so the
 * Calling tab and the Reports shell can be built independently (disjoint file
 * ownership). Merge them into the shared CRM reports service in a later pass.
 *
 * All response payloads are snake_case (backend contract). Day/hour bucketing is
 * done server-side in the institute's configured report timezone.
 */
import { isAxiosError } from 'axios';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';

// authenticatedAxiosInstance has no baseURL and there's no Vite dev proxy for
// /admin-core-service, so endpoints must include the backend host.
const CALLS_DAILY_URL = `${BASE_URL}/admin-core-service/v1/reports/calls-daily`;
const CALLS_HEATMAP_URL = `${BASE_URL}/admin-core-service/v1/reports/calls-heatmap`;

// ── Shared request params ──────────────────────────────────────────────

export interface CallingReportParams {
    instituteId: string;
    /** yyyy-MM-dd (inclusive). */
    fromDate?: string;
    /** yyyy-MM-dd (inclusive). */
    toDate?: string;
    teamId?: string;
    counsellorUserId?: string;
}

// ── GET /v1/reports/calls-daily ────────────────────────────────────────

export interface CallsDailyPoint {
    /** yyyy-MM-dd in the institute's report timezone. */
    date: string;
    dials: number;
    connected: number;
    /** 0–100, null when dials = 0. */
    connect_rate: number | null;
    talk_seconds: number;
}

export interface CallsByCounsellorRow {
    user_id: string;
    name: string;
    dials: number;
    connected: number;
    /** 0–100, null when dials = 0. */
    connect_rate: number | null;
    talk_seconds: number;
    avg_call_seconds: number | null;
    /** Terminal CALL_STATUS → count (e.g. { COMPLETED: 12, NO_ANSWER: 4 }). */
    outcomes: Record<string, number>;
}

export interface CallsDailyReport {
    days: CallsDailyPoint[];
    by_counsellor: CallsByCounsellorRow[];
}

export const callsDailyQueryKey = (p: CallingReportParams) =>
    [
        'crm-reports-calls-daily',
        p.instituteId,
        p.fromDate,
        p.toDate,
        p.teamId,
        p.counsellorUserId,
    ] as const;

export async function fetchCallsDaily(p: CallingReportParams): Promise<CallsDailyReport> {
    const { data } = await authenticatedAxiosInstance.get(CALLS_DAILY_URL, {
        params: {
            instituteId: p.instituteId,
            fromDate: p.fromDate,
            toDate: p.toDate,
            teamId: p.teamId,
            counsellorUserId: p.counsellorUserId,
        },
    });
    return {
        days: Array.isArray(data?.days) ? data.days : [],
        by_counsellor: Array.isArray(data?.by_counsellor) ? data.by_counsellor : [],
    };
}

// ── GET /v1/reports/calls-heatmap ──────────────────────────────────────

export interface CallsHeatmapCell {
    /** ISO day of week: 1 = Monday … 7 = Sunday (institute timezone). */
    dow: number;
    /** Hour of day 0–23 (institute timezone). */
    hour: number;
    dials: number;
    connected: number;
}

export interface CallsHeatmapReport {
    cells: CallsHeatmapCell[];
}

export const callsHeatmapQueryKey = (p: CallingReportParams) =>
    [
        'crm-reports-calls-heatmap',
        p.instituteId,
        p.fromDate,
        p.toDate,
        p.teamId,
        p.counsellorUserId,
    ] as const;

export async function fetchCallsHeatmap(p: CallingReportParams): Promise<CallsHeatmapReport> {
    const { data } = await authenticatedAxiosInstance.get(CALLS_HEATMAP_URL, {
        params: {
            instituteId: p.instituteId,
            fromDate: p.fromDate,
            toDate: p.toDate,
            teamId: p.teamId,
            counsellorUserId: p.counsellorUserId,
        },
    });
    return { cells: Array.isArray(data?.cells) ? data.cells : [] };
}

// ── Error classification ───────────────────────────────────────────────

/**
 * True when the reports endpoints don't exist on this backend yet (the
 * immediate post-merge reality until the next backend deploy). The prod
 * gateway answers unknown paths with an empty 403 rather than a 404, so both
 * are treated as "deploy pending" — genuine RBAC denials on these endpoints
 * surface as zeroed reports (scope CSV = ""), never as 403s.
 */
export function isReportEndpointMissing(error: unknown): boolean {
    return (
        isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 403)
    );
}
