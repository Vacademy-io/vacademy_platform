/**
 * Manager (team-rollup) tab data layer — the single report endpoint consumed
 * ONLY by the Manager tab of the Reports Center:
 *
 *   GET /admin-core-service/v1/reports/team-rollup
 *
 * NOTE ON OWNERSHIP / DUPLICATION: this fetcher deliberately lives next to its
 * tab (manager-tab.tsx) rather than the shared ../-services/get-crm-reports.ts
 * so the Manager tab and the Reports shell can be built independently (disjoint
 * file ownership). The base URL + request-param shape + endpoint-missing
 * classification mirror get-crm-reports.ts exactly. Fold into the shared CRM
 * reports service in a later pass.
 *
 * All response payloads are snake_case (backend contract — the Java DTO uses
 * camelCase fields + @JsonNaming(SnakeCaseStrategy), same as the other report
 * DTOs). Aggregation (per-team rollup of leads / responded / conversions /
 * open / overdue / avg response / target attainment) is done server-side in the
 * institute's configured report timezone and RBAC-scoped to the caller's
 * leads-subtree visibility.
 */
import { isAxiosError } from 'axios';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';

// authenticatedAxiosInstance has no baseURL and there's no Vite dev proxy for
// /admin-core-service, so the endpoint must include the backend host. Same base
// path the shared get-crm-reports.ts builds its URLs from.
const TEAM_ROLLUP_URL = `${BASE_URL}/admin-core-service/v1/reports/team-rollup`;

// ── Request params ─────────────────────────────────────────────────────

export interface ManagerReportParams {
    instituteId: string;
    /** yyyy-MM-dd (inclusive, institute timezone). */
    fromDate?: string;
    /** yyyy-MM-dd (inclusive, institute timezone). */
    toDate?: string;
    teamId?: string;
    counsellorUserId?: string;
}

function toRequestParams(p: ManagerReportParams) {
    return {
        instituteId: p.instituteId,
        fromDate: p.fromDate,
        toDate: p.toDate,
        teamId: p.teamId,
        counsellorUserId: p.counsellorUserId,
    };
}

// ── GET /v1/reports/team-rollup ────────────────────────────────────────

export interface TeamRollupRow {
    /** Team id; null on the synthesized totals row. */
    team_id: string | null;
    /** Team display name; "Total" / null on the totals row. */
    team_name: string | null;
    /** Team head's hydrated name (auth-service batch lookup); null when none / hydration fails. */
    head_name: string | null;
    /** Distinct counsellors in the team's scope. */
    counsellors: number;
    leads: number;
    /** Leads that received at least one response/activity. */
    responded: number;
    conversions: number;
    /** % 0–100; null when leads = 0. */
    conversion_rate: number | null;
    /** Open (non-terminal) leads, point-in-time. */
    open: number;
    /** Open leads with an overdue follow-up, point-in-time. */
    overdue: number;
    /** Mean minutes to first response; null when nothing responded. */
    avg_response_minutes: number | null;
    /** Configured conversions target for the window; null when unset. */
    target: number | null;
    /** conversions ÷ target as a 0–100 percentage; null when target unset/0. */
    attainment_pct: number | null;
}

export interface TeamRollupReport {
    teams: TeamRollupRow[];
    /** Column rollup across all teams; conversion_rate / attainment_pct recomputed over the sums. */
    totals: TeamRollupRow | null;
}

export const teamRollupQueryKey = (p: ManagerReportParams) =>
    [
        'crm-reports-team-rollup',
        p.instituteId,
        p.fromDate,
        p.toDate,
        p.teamId,
        p.counsellorUserId,
    ] as const;

export async function fetchTeamRollup(p: ManagerReportParams): Promise<TeamRollupReport> {
    const { data } = await authenticatedAxiosInstance.get(TEAM_ROLLUP_URL, {
        params: toRequestParams(p),
    });
    return {
        teams: Array.isArray(data?.teams) ? data.teams : [],
        totals: data?.totals ?? null,
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
