import { useQuery } from '@tanstack/react-query';
import {
    getCenterHeatmap,
    getDailyParticipation,
    getEngagementLeaderboard,
    getCompletionCohort,
    getCampaigns,
    getReferralLeads,
    getFacebookLeadsBundle,
    getLeadJourneyFunnel,
    challengeAnalyticsKeys,
} from '@/services/challenge-analytics';

export function useCenterHeatmap(startDate: string, endDate: string, enabled: boolean = true) {
    return useQuery({
        queryKey: challengeAnalyticsKeys.centerHeatmap(startDate, endDate),
        queryFn: () => getCenterHeatmap(startDate, endDate),
        enabled: enabled && !!startDate && !!endDate,
        staleTime: 5 * 60 * 1000,
    });
}

export function useDailyParticipation(startDate: string, endDate: string, enabled: boolean = true) {
    return useQuery({
        queryKey: challengeAnalyticsKeys.dailyParticipation(startDate, endDate),
        queryFn: () => getDailyParticipation(startDate, endDate),
        enabled: enabled && !!startDate && !!endDate,
        staleTime: 5 * 60 * 1000,
    });
}

export function useEngagementLeaderboard(
    startDate: string,
    endDate: string,
    page: number = 1,
    pageSize: number = 20,
    enabled: boolean = true,
    customFieldFilter?: { name: string; value: string }
) {
    return useQuery({
        queryKey: challengeAnalyticsKeys.leaderboard(
            startDate,
            endDate,
            page,
            customFieldFilter?.name,
            customFieldFilter?.value
        ),
        queryFn: () =>
            getEngagementLeaderboard(startDate, endDate, page, pageSize, customFieldFilter),
        enabled: enabled && !!startDate && !!endDate,
        staleTime: 5 * 60 * 1000,
    });
}

export function useCompletionCohort(
    startDate: string,
    endDate: string,
    templateIdentifiers: string[],
    page: number = 1,
    pageSize: number = 50,
    enabled: boolean = true
) {
    return useQuery({
        queryKey: challengeAnalyticsKeys.completionCohort(
            startDate,
            endDate,
            templateIdentifiers,
            page
        ),
        queryFn: () => getCompletionCohort(startDate, endDate, templateIdentifiers, page, pageSize),
        enabled: enabled && !!startDate && !!endDate && templateIdentifiers.length > 0,
        staleTime: 5 * 60 * 1000,
    });
}

export function useCampaigns(
    campaignType?: string,
    status?: string,
    page: number = 0,
    pageSize: number = 20,
    enabled: boolean = true
) {
    return useQuery({
        queryKey: challengeAnalyticsKeys.campaigns(campaignType, status, page),
        queryFn: () => getCampaigns(campaignType, status, page, pageSize),
        enabled,
        staleTime: 5 * 60 * 1000,
    });
}

export function useReferralLeads(
    audienceId: string,
    startDate: string,
    endDate: string,
    page: number = 0,
    pageSize: number = 20,
    enabled: boolean = true
) {
    return useQuery({
        queryKey: challengeAnalyticsKeys.referralLeads(audienceId, startDate, endDate, page),
        queryFn: () => getReferralLeads(audienceId, startDate, endDate, page, pageSize),
        enabled: enabled && !!audienceId && !!startDate && !!endDate,
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Fetch every Facebook lead (active + opted-out) across the given SOCIAL MEDIA
 * audience ids and date window.
 */
export function useFacebookLeads(
    audienceIds: string[],
    startDate: string,
    endDate: string,
    enabled: boolean = true
) {
    return useQuery({
        queryKey: challengeAnalyticsKeys.facebookLeads(audienceIds, startDate, endDate),
        queryFn: () => getFacebookLeadsBundle(audienceIds, startDate, endDate),
        enabled: enabled && audienceIds.length > 0 && !!startDate && !!endDate,
        staleTime: 5 * 60 * 1000,
    });
}

/** Lead-journey daily-message funnel (per-day sends/recipients/replies + roster). */
export function useLeadJourneyFunnel(
    startDate: string,
    endDate: string,
    enabled: boolean = true
) {
    return useQuery({
        queryKey: challengeAnalyticsKeys.leadJourneyFunnel(startDate, endDate),
        queryFn: () => getLeadJourneyFunnel(startDate, endDate),
        enabled: enabled && !!startDate && !!endDate,
        staleTime: 5 * 60 * 1000,
    });
}
