/**
 * Activity tab data layer — the Counsellor Activity Timeline report consumed
 * ONLY by the Activity tab of the Reports Center:
 *
 *   GET /admin-core-service/v1/reports/activity-timeline
 *
 * NOTE ON OWNERSHIP / DUPLICATION: this fetcher deliberately lives next to the
 * Activity tab instead of the shared ../-services/get-crm-reports.ts so the
 * Activity tab can be built independently (disjoint file ownership). Merge into
 * the shared CRM reports service in a later pass.
 *
 * The endpoint counts timeline_event rows per counsellor over the window —
 * notes added, calls logged, status changes, and follow-ups created / closed —
 * plus a daily total series for the activity strip. All response payloads are
 * snake_case (backend @JsonNaming SnakeCaseStrategy contract). Day bucketing is
 * done server-side in the institute's configured report timezone.
 */
import { isAxiosError } from 'axios';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';

// authenticatedAxiosInstance has no baseURL and there's no Vite dev proxy for
// /admin-core-service, so the endpoint must include the backend host. Built
// from the same BASE_URL the shared get-crm-reports.ts uses.
const ACTIVITY_TIMELINE_URL = `${BASE_URL}/admin-core-service/v1/reports/activity-timeline`;

// ── Request params ─────────────────────────────────────────────────────

export interface ActivityReportParams {
    instituteId: string;
    /** yyyy-MM-dd (inclusive, institute timezone). */
    fromDate?: string;
    /** yyyy-MM-dd (inclusive, institute timezone). */
    toDate?: string;
    teamId?: string;
    counsellorUserId?: string;
}

// ── GET /v1/reports/activity-timeline ──────────────────────────────────

export interface ActivityByCounsellorRow {
    user_id: string;
    /** Hydrated via auth-service batch lookup; null when hydration fails. */
    name: string | null;
    notes: number;
    calls: number;
    status_changes: number;
    followups_created: number;
    followups_closed: number;
    /** Sum of the activity columns for this counsellor. */
    total: number;
}

export interface ActivityDayPoint {
    /** yyyy-MM-dd in the institute's report timezone. */
    date: string;
    total: number;
}

export interface ActivityTimelineReport {
    by_counsellor: ActivityByCounsellorRow[];
    daily: ActivityDayPoint[];
}

export const activityTimelineQueryKey = (p: ActivityReportParams) =>
    [
        'crm-reports-activity-timeline',
        p.instituteId,
        p.fromDate,
        p.toDate,
        p.teamId,
        p.counsellorUserId,
    ] as const;

export async function fetchActivityTimeline(
    p: ActivityReportParams
): Promise<ActivityTimelineReport> {
    const { data } = await authenticatedAxiosInstance.get(ACTIVITY_TIMELINE_URL, {
        params: {
            instituteId: p.instituteId,
            fromDate: p.fromDate,
            toDate: p.toDate,
            teamId: p.teamId,
            counsellorUserId: p.counsellorUserId,
        },
    });
    return {
        by_counsellor: Array.isArray(data?.by_counsellor) ? data.by_counsellor : [],
        daily: Array.isArray(data?.daily) ? data.daily : [],
    };
}

// ── Error classification ───────────────────────────────────────────────

/**
 * True when the reports endpoint doesn't exist on this backend yet (the
 * immediate post-merge reality until the next backend deploy). The prod
 * gateway answers unknown paths with an empty 403 rather than a 404, so both
 * are treated as "deploy pending" — genuine RBAC denials on this endpoint
 * surface as zeroed reports (scope CSV = ""), never as 403s.
 */
export function isReportEndpointMissing(error: unknown): boolean {
    return (
        isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 403)
    );
}
