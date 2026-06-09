import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    SALES_DASHBOARD_CALLS_PER_DAY,
    SALES_DASHBOARD_CAMPAIGN_CARDS,
    SALES_DASHBOARD_CONVERSION_BY_SOURCE,
    SALES_DASHBOARD_FUNNEL,
    SALES_DASHBOARD_INSIGHTS,
    SALES_DASHBOARD_KPI,
    SALES_DASHBOARD_LEADERBOARD,
    SALES_DASHBOARD_MISSED_FOLLOWUPS,
    SALES_DASHBOARD_NEW_VS_EXISTING,
    SALES_DASHBOARD_REASSIGNMENTS,
    SALES_DASHBOARD_UPCOMING_FOLLOWUPS,
} from '@/constants/urls';

export interface KpiResponse {
    total_leads: number;
    open_leads: number;
    conversions: number;
    conversion_rate: number;
    active_counsellors: number;
    overdue_followups: number;
}

export interface FunnelStage {
    status_key: string;
    label: string;
    color: string;
    count: number;
    order: number;
}

export interface TimeSeriesPoint {
    date: string;
    primary: number;
    secondary: number | null;
}

export interface FollowupRow {
    followup_id: string;
    lead_id: string | null;
    lead_name: string | null;
    counsellor_user_id: string | null;
    counsellor_name: string | null;
    schedule_time: string | null;
    status: string;
    content: string | null;
    minutes_until_due: number | null;
}

export interface CampaignCard {
    campaign_id: string;
    campaign_name: string;
    campaign_type: string;
    leads_in_window: number;
    conversions_in_window: number;
    conversion_rate: number;
    top_counsellor_user_id: string | null;
    top_counsellor_name: string | null;
    top_counsellor_conversions: number | null;
}

export interface InsightItem {
    key: string;
    severity: 'INFO' | 'SUCCESS' | 'WARN' | 'DANGER';
    headline: string;
    detail: string | null;
}

export async function fetchKpi(instituteId: string, teamId?: string, from?: number, to?: number) {
    const { data } = await authenticatedAxiosInstance.get<KpiResponse>(
        SALES_DASHBOARD_KPI(instituteId, teamId, from, to)
    );
    return data;
}

export async function fetchFunnel(instituteId: string, teamId?: string, from?: number, to?: number) {
    const { data } = await authenticatedAxiosInstance.get<FunnelStage[]>(
        SALES_DASHBOARD_FUNNEL(instituteId, teamId, from, to)
    );
    return data;
}

export async function fetchReassignmentSeries(instituteId: string, from?: number, to?: number) {
    const { data } = await authenticatedAxiosInstance.get<TimeSeriesPoint[]>(
        SALES_DASHBOARD_REASSIGNMENTS(instituteId, from, to)
    );
    return data;
}

export async function fetchUpcomingFollowups(instituteId: string, teamId?: string) {
    const { data } = await authenticatedAxiosInstance.get<FollowupRow[]>(
        SALES_DASHBOARD_UPCOMING_FOLLOWUPS(instituteId, teamId)
    );
    return data;
}

export async function fetchMissedFollowups(instituteId: string, teamId?: string) {
    const { data } = await authenticatedAxiosInstance.get<FollowupRow[]>(
        SALES_DASHBOARD_MISSED_FOLLOWUPS(instituteId, teamId)
    );
    return data;
}

export async function fetchNewVsExisting(
    instituteId: string,
    teamId?: string,
    from?: number,
    to?: number
) {
    const { data } = await authenticatedAxiosInstance.get<TimeSeriesPoint[]>(
        SALES_DASHBOARD_NEW_VS_EXISTING(instituteId, teamId, from, to)
    );
    return data;
}

export async function fetchCampaignCards(
    instituteId: string,
    period: 'DAY' | 'WEEK' | 'MONTH' = 'WEEK'
) {
    const { data } = await authenticatedAxiosInstance.get<CampaignCard[]>(
        SALES_DASHBOARD_CAMPAIGN_CARDS(instituteId, period)
    );
    return data;
}

export async function fetchInsights(instituteId: string, teamId?: string) {
    const { data } = await authenticatedAxiosInstance.get<InsightItem[]>(
        SALES_DASHBOARD_INSIGHTS(instituteId, teamId)
    );
    return data;
}

export interface SourceConversion {
    source: string;
    leads: number;
    conversions: number;
    conversion_rate: number;
}

export async function fetchConversionBySource(
    instituteId: string,
    teamId?: string,
    counsellorUserId?: string,
    from?: number,
    to?: number
) {
    const { data } = await authenticatedAxiosInstance.get<SourceConversion[]>(
        SALES_DASHBOARD_CONVERSION_BY_SOURCE(instituteId, teamId, counsellorUserId, from, to)
    );
    return data;
}

export async function fetchCallsPerDay(
    instituteId: string,
    teamId?: string,
    counsellorUserId?: string,
    from?: number,
    to?: number
) {
    const { data } = await authenticatedAxiosInstance.get<TimeSeriesPoint[]>(
        SALES_DASHBOARD_CALLS_PER_DAY(instituteId, teamId, counsellorUserId, from, to)
    );
    return data;
}

export { SALES_DASHBOARD_LEADERBOARD };
