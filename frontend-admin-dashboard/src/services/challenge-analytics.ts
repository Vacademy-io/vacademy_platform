import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import type {
    CenterHeatmapRequest,
    CenterHeatmapResponse,
    DailyParticipationRequest,
    DailyParticipationResponse,
    LeaderboardRequest,
    LeaderboardResponse,
    CompletionCohortRequest,
    CompletionCohortResponse,
    OutgoingTemplatesResponse,
    CampaignFilterRequest,
    CampaignListResponse,
    ReferralLeadsRequest,
    ReferralLeadsResponse,
    AudienceLeadFilterRequest,
    AudienceLeadsResponse,
    FacebookLeadsBundle,
    LeadJourneyFunnelResponse,
} from '@/types/challenge-analytics';

// Base URLs for services
const ADMIN_CORE_BASE = `${BASE_URL}/admin-core-service`;
const NOTIFICATION_BASE = `${BASE_URL}/notification-service`;

/**
 * Helper function to convert ISO 8601 date format to space-separated format
 * notification-service APIs require: "yyyy-mm-dd hh:mm:ss"
 * admin-core-service APIs require: "yyyy-mm-ddThh:mm:ss"
 */
const toNotificationDateFormat = (isoDate: string): string => {
    return isoDate.replace('T', ' ');
};

/**
 * Feature 1: Get Center Heatmap Data
 * Visualize which centers parents are most interested in
 */
export const getCenterHeatmap = async (
    startDate: string,
    endDate: string,
    status?: string
): Promise<CenterHeatmapResponse> => {
    const instituteId = getCurrentInstituteId();

    if (!instituteId) {
        throw new Error('Institute ID not found');
    }

    const requestBody: CenterHeatmapRequest = {
        institute_id: instituteId,
        start_date: startDate,
        end_date: endDate,
        status,
    };

    const response = await authenticatedAxiosInstance.post<CenterHeatmapResponse>(
        `${ADMIN_CORE_BASE}/v1/audience/center-heatmap`,
        requestBody
    );

    return response.data;
};

/**
 * Feature 2, 3, 4: Get Daily Participation Metrics
 * Track parent attendance across challenge days
 */
export const getDailyParticipation = async (
    startDate: string,
    endDate: string
): Promise<DailyParticipationResponse> => {
    const instituteId = getCurrentInstituteId();

    if (!instituteId) {
        throw new Error('Institute ID not found');
    }

    const requestBody: DailyParticipationRequest = {
        institute_id: instituteId,
        // daily-participation uses java.time.LocalDateTime which requires ISO 8601 with 'T'
        start_date: startDate,
        end_date: endDate,
    };

    const response = await authenticatedAxiosInstance.post<DailyParticipationResponse>(
        `${NOTIFICATION_BASE}/analytics/daily-participation`,
        requestBody
    );

    return response.data;
};

/**
 * Feature 7: Get Engagement Leaderboard
 * Identify and reward "Power Users"
 */
export const getEngagementLeaderboard = async (
    startDate: string,
    endDate: string,
    page: number = 1,
    pageSize: number = 20,
    customFieldFilter?: { name: string; value: string }
): Promise<LeaderboardResponse> => {
    const instituteId = getCurrentInstituteId();

    if (!instituteId) {
        throw new Error('Institute ID not found');
    }

    const hasFilter =
        !!customFieldFilter &&
        !!customFieldFilter.name &&
        !!customFieldFilter.value;

    const requestBody: LeaderboardRequest = {
        institute_id: instituteId,
        start_date: toNotificationDateFormat(startDate),
        end_date: toNotificationDateFormat(endDate),
        page,
        page_size: pageSize,
        ...(hasFilter
            ? {
                  custom_field_name: customFieldFilter!.name,
                  custom_field_value: customFieldFilter!.value,
              }
            : {}),
    };

    const response = await authenticatedAxiosInstance.post<LeaderboardResponse>(
        `${NOTIFICATION_BASE}/analytics/engagement-leaderboard`,
        requestBody
    );

    return response.data;
};

/**
 * Feature 8: Get Completion Cohort
 * Identify users who completed challenges
 */
export const getCompletionCohort = async (
    startDate: string,
    endDate: string,
    templateIdentifiers: string[],
    page: number = 1,
    pageSize: number = 50
): Promise<CompletionCohortResponse> => {
    const instituteId = getCurrentInstituteId();

    if (!instituteId) {
        throw new Error('Institute ID not found');
    }

    const requestBody: CompletionCohortRequest = {
        institute_id: instituteId,
        completion_template_identifiers: templateIdentifiers,
        start_date: toNotificationDateFormat(startDate),
        end_date: toNotificationDateFormat(endDate),
        page,
        page_size: pageSize,
    };

    const response = await authenticatedAxiosInstance.post<CompletionCohortResponse>(
        `${NOTIFICATION_BASE}/analytics/completion-cohort`,
        requestBody
    );

    return response.data;
};

/**
 * Helper API: Get Outgoing Templates
 * Populate dropdown filters with available template identifiers
 */
export const getOutgoingTemplates = async (): Promise<OutgoingTemplatesResponse> => {
    const instituteId = getCurrentInstituteId();

    if (!instituteId) {
        throw new Error('Institute ID not found');
    }

    const response = await authenticatedAxiosInstance.get<OutgoingTemplatesResponse>(
        `${NOTIFICATION_BASE}/analytics/outgoing-templates`,
        {
            params: { institute_id: instituteId },
        }
    );

    return response.data;
};

/**
 * Feature 6: Get Campaigns for Referral Tracking
 * Track referral acquisition by listing all audience campaigns
 */
export const getCampaigns = async (
    campaignType?: string,
    status?: string,
    pageNo: number = 0,
    pageSize: number = 20
): Promise<CampaignListResponse> => {
    const instituteId = getCurrentInstituteId();

    if (!instituteId) {
        throw new Error('Institute ID not found');
    }

    const requestBody: CampaignFilterRequest = {
        institute_id: instituteId,
        campaign_type: campaignType,
        status,
    };

    const response = await authenticatedAxiosInstance.post<CampaignListResponse>(
        `${ADMIN_CORE_BASE}/v1/audience/campaigns`,
        requestBody,
        {
            params: { pageNo, pageSize },
        }
    );

    return response.data;
};

/**
 * Facebook Leads: generic rich-lead fetch from POST /v1/audience/leads.
 * Returns lifecycle status fields and custom field values per lead.
 */
export const getAudienceLeads = async (
    req: AudienceLeadFilterRequest
): Promise<AudienceLeadsResponse> => {
    const page = req.page ?? 0;
    const size = req.size ?? 50;
    const response = await authenticatedAxiosInstance.post<AudienceLeadsResponse>(
        `${ADMIN_CORE_BASE}/v1/audience/leads`,
        { ...req, page, size },
        { params: { pageNo: page, pageSize: size } }
    );
    return response.data;
};

/**
 * Fetch every Facebook lead (active + opted-out) across the given SOCIAL MEDIA
 * audiences and date window. Facebook leads all funnel into one (or few)
 * audiences, so this fans out one active + one opted-out query per audience and
 * merges the results client-side. The opted-out set is fetched separately
 * because the leads endpoint excludes OPTED_OUT rows by default.
 */
export const getFacebookLeadsBundle = async (
    audienceIds: string[],
    fromLocal: string,
    toLocal: string
): Promise<FacebookLeadsBundle> => {
    const SIZE = 500;
    const bundle: FacebookLeadsBundle = { active: [], optedOut: [] };

    // The /leads endpoint compares submitted_at (UTC) against the value as-is, so
    // send a UTC instant — same convention as the Audience Manager leads pages.
    // (The dashboard's date strings are local wall-clock; convert them to UTC.)
    const toUtcIso = (local: string): string | undefined => {
        if (!local) return undefined;
        const d = new Date(local);
        return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
    };
    const fromUtc = toUtcIso(fromLocal);
    const toUtc = toUtcIso(toLocal);

    await Promise.all(
        audienceIds.flatMap((audienceId) => [
            getAudienceLeads({
                audience_id: audienceId,
                conversion_status_filter: 'ALL',
                submitted_from_local: fromUtc,
                submitted_to_local: toUtc,
                page: 0,
                size: SIZE,
            }).then((r) => {
                bundle.active.push(...(r.content || []));
            }),
            getAudienceLeads({
                audience_id: audienceId,
                conversion_status_filter: 'ALL',
                overall_statuses: ['OPTED_OUT'],
                submitted_from_local: fromUtc,
                submitted_to_local: toUtc,
                page: 0,
                size: SIZE,
            }).then((r) => {
                bundle.optedOut.push(...(r.content || []));
            }),
        ])
    );

    return bundle;
};

/**
 * Lead-Journey daily-message funnel: per-day send/recipient/reply metrics + a
 * per-recipient roster for the multi-day WhatsApp drip (default template prefix
 * 'lead_journey_day_'). Dates are passed as ISO-with-'T' (the endpoint binds a
 * LocalDateTime), so — unlike the leaderboard/cohort APIs — no space conversion.
 */
export const getLeadJourneyFunnel = async (
    startDate: string,
    endDate: string,
    templatePrefix?: string
): Promise<LeadJourneyFunnelResponse> => {
    const instituteId = getCurrentInstituteId();

    if (!instituteId) {
        throw new Error('Institute ID not found');
    }

    const response = await authenticatedAxiosInstance.post<LeadJourneyFunnelResponse>(
        `${NOTIFICATION_BASE}/analytics/lead-journey-funnel`,
        {
            institute_id: instituteId,
            start_date: startDate,
            end_date: endDate,
            ...(templatePrefix ? { template_prefix: templatePrefix } : {}),
        }
    );

    return response.data;
};

// ============================================
// React Query Keys
// ============================================

export const challengeAnalyticsKeys = {
    all: ['challenge-analytics'] as const,
    centerHeatmap: (startDate: string, endDate: string) =>
        [...challengeAnalyticsKeys.all, 'center-heatmap', startDate, endDate] as const,
    dailyParticipation: (startDate: string, endDate: string) =>
        [...challengeAnalyticsKeys.all, 'daily-participation', startDate, endDate] as const,
    leaderboard: (
        startDate: string,
        endDate: string,
        page: number,
        customFieldName?: string,
        customFieldValue?: string
    ) =>
        [
            ...challengeAnalyticsKeys.all,
            'leaderboard',
            startDate,
            endDate,
            page,
            customFieldName ?? '',
            customFieldValue ?? '',
        ] as const,
    completionCohort: (startDate: string, endDate: string, templates: string[], page: number) =>
        [
            ...challengeAnalyticsKeys.all,
            'completion-cohort',
            startDate,
            endDate,
            templates,
            page,
        ] as const,
    outgoingTemplates: () => [...challengeAnalyticsKeys.all, 'outgoing-templates'] as const,
    campaigns: (campaignType?: string, status?: string, page?: number) =>
        [...challengeAnalyticsKeys.all, 'campaigns', campaignType, status, page] as const,
    referralLeads: (audienceId: string, startDate: string, endDate: string, page: number) =>
        [
            ...challengeAnalyticsKeys.all,
            'referral-leads',
            audienceId,
            startDate,
            endDate,
            page,
        ] as const,
    facebookLeads: (audienceIds: string[], startDate: string, endDate: string) =>
        [
            ...challengeAnalyticsKeys.all,
            'facebook-leads',
            [...audienceIds].sort().join(','),
            startDate,
            endDate,
        ] as const,
    leadJourneyFunnel: (startDate: string, endDate: string) =>
        [...challengeAnalyticsKeys.all, 'lead-journey-funnel', startDate, endDate] as const,
};

/**
 * Feature 6: Get Referral Leads
 * Get leads for a specific referral campaign
 */
export const getReferralLeads = async (
    audienceId: string,
    startDate: string,
    endDate: string,
    page: number = 0,
    pageSize: number = 20
): Promise<ReferralLeadsResponse> => {
    const requestBody: ReferralLeadsRequest = {
        audience_id: audienceId,
        submitted_from_local: startDate,
        submitted_to_local: endDate,
        page,
        size: pageSize,
    };

    const response = await authenticatedAxiosInstance.post<ReferralLeadsResponse>(
        `${ADMIN_CORE_BASE}/v1/audience/leads`,
        requestBody,
        {
            params: { pageNo: page, pageSize },
        }
    );

    return response.data;
};
