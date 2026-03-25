import { useQuery } from '@tanstack/react-query';
import {
    getCenterHeatmap,
    getDailyParticipation,
    getEngagementLeaderboard,
    getCompletionCohort,
    getCampaigns,
    getReferralLeads,
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
    enabled: boolean = true
) {
    return useQuery({
        queryKey: challengeAnalyticsKeys.leaderboard(startDate, endDate, page),
        queryFn: () => getEngagementLeaderboard(startDate, endDate, page, pageSize),
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
