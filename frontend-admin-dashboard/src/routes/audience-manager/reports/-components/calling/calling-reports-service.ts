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

// ── GET /v1/reports/calls-by-lead ──────────────────────────────────────

export type CallsByLeadView = 'CALLED' | 'UNCALLED';

export interface CallsByLeadParams extends CallingReportParams {
    audienceId?: string;
    /** Substring match on lead name / mobile. */
    search?: string;
    view: CallsByLeadView;
    page: number;
    size: number;
}

export interface CallsByLeadSummary {
    leads_called: number;
    total_dials: number;
    leads_connected: number;
    leads_callback: number;
    leads_never_connected: number;
    uncalled_new_leads: number;
}

export interface CalledLeadRow {
    response_id: string;
    user_id: string | null;
    lead_name: string | null;
    lead_phone: string | null;
    lead_status_label: string | null;
    lead_status_color: string | null;
    counsellor_user_id: string | null;
    counsellor_name: string | null;
    attempts: number;
    connected: number;
    callbacks: number;
    not_picked: number;
    failed: number;
    /** ISO-8601 UTC. */
    last_call_at: string | null;
    last_call_status: string | null;
    last_disposition_key: string | null;
    next_callback_at: string | null;
}

export interface UncalledLeadRow {
    response_id: string;
    user_id: string | null;
    lead_name: string | null;
    lead_phone: string | null;
    source_type: string | null;
    /** ISO-8601 UTC. */
    submitted_at: string | null;
    lead_status_label: string | null;
    lead_status_color: string | null;
    counsellor_user_id: string | null;
    counsellor_name: string | null;
}

export interface CallsByLeadReport {
    summary: CallsByLeadSummary;
    rows: CalledLeadRow[];
    uncalled_rows: UncalledLeadRow[];
    total_rows: number;
    page: number;
    size: number;
}

const CALLS_BY_LEAD_URL = `${BASE_URL}/admin-core-service/v1/reports/calls-by-lead`;

export const callsByLeadQueryKey = (p: CallsByLeadParams) =>
    [
        'crm-reports-calls-by-lead',
        p.instituteId,
        p.fromDate,
        p.toDate,
        p.teamId,
        p.counsellorUserId,
        p.audienceId,
        p.search,
        p.view,
        p.page,
        p.size,
    ] as const;

export async function fetchCallsByLead(p: CallsByLeadParams): Promise<CallsByLeadReport> {
    const { data } = await authenticatedAxiosInstance.get(CALLS_BY_LEAD_URL, {
        params: {
            instituteId: p.instituteId,
            fromDate: p.fromDate,
            toDate: p.toDate,
            teamId: p.teamId,
            counsellorUserId: p.counsellorUserId,
            audienceId: p.audienceId,
            search: p.search || undefined,
            view: p.view,
            page: p.page,
            size: p.size,
        },
    });
    return {
        summary: {
            leads_called: data?.summary?.leads_called ?? 0,
            total_dials: data?.summary?.total_dials ?? 0,
            leads_connected: data?.summary?.leads_connected ?? 0,
            leads_callback: data?.summary?.leads_callback ?? 0,
            leads_never_connected: data?.summary?.leads_never_connected ?? 0,
            uncalled_new_leads: data?.summary?.uncalled_new_leads ?? 0,
        },
        rows: Array.isArray(data?.rows) ? data.rows : [],
        uncalled_rows: Array.isArray(data?.uncalled_rows) ? data.uncalled_rows : [],
        total_rows: data?.total_rows ?? 0,
        page: data?.page ?? 0,
        size: data?.size ?? p.size,
    };
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
