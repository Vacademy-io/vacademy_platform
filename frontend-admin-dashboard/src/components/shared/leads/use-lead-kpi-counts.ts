import { useQueries } from '@tanstack/react-query';

/**
 * use-lead-kpi-counts — derives the KPI strip counts (Total / Hot / Warm / Cold
 * / Converted) purely from READ-ONLY calls to the existing leads endpoint.
 *
 * Each metric is one `size:1` filtered request whose `totalElements` is the
 * count — so this adds reads, never a new endpoint. Queries run in parallel,
 * cache independently, and refetch when the active filters (encoded in
 * `basePayload`) change.
 */

export type LeadKpiMetric = 'TOTAL' | 'HOT' | 'WARM' | 'COLD' | 'CONVERTED';

export const LEAD_KPI_METRICS: LeadKpiMetric[] = ['TOTAL', 'HOT', 'WARM', 'COLD', 'CONVERTED'];

// Tier cards count still-active leads; Converted is its own bucket; Total spans all.
const METRIC_PARAMS: Record<LeadKpiMetric, Record<string, unknown>> = {
    TOTAL: { conversion_status_filter: 'ALL' },
    HOT: { lead_tier: 'HOT', conversion_status_filter: 'EXCLUDE_CONVERTED' },
    WARM: { lead_tier: 'WARM', conversion_status_filter: 'EXCLUDE_CONVERTED' },
    COLD: { lead_tier: 'COLD', conversion_status_filter: 'EXCLUDE_CONVERTED' },
    CONVERTED: { conversion_status_filter: 'ONLY_CONVERTED' },
};

interface UseLeadKpiCountsArgs {
    /** Stable surface discriminator, e.g. 'recent' | 'campaign'. */
    surfaceId: string;
    /** instituteId (recent) or audienceId (campaign) — scopes the cache key. */
    scopeId: string;
    /** The surface's list fetcher (fetchRecentLeads | fetchCampaignLeads). */
    fetchFn: (payload: Record<string, unknown>) => Promise<{ totalElements: number }>;
    /**
     * institute_id/audience_id + active date range + search. MUST NOT include
     * lead_tier / conversion_status_filter / page / size — those are set here.
     */
    basePayload: Record<string, unknown>;
    enabled: boolean;
}

export function useLeadKpiCounts({
    surfaceId,
    scopeId,
    fetchFn,
    basePayload,
    enabled,
}: UseLeadKpiCountsArgs) {
    const baseKey = JSON.stringify(basePayload);

    const results = useQueries({
        queries: LEAD_KPI_METRICS.map((metric) => ({
            // baseKey is the serialized basePayload, so the key already captures it.
            // eslint-disable-next-line @tanstack/query/exhaustive-deps
            queryKey: ['lead-kpi', surfaceId, scopeId, baseKey, metric],
            queryFn: () =>
                fetchFn({
                    ...basePayload,
                    ...METRIC_PARAMS[metric],
                    page: 0,
                    size: 1,
                }).then((r) => r.totalElements ?? 0),
            enabled: enabled && !!scopeId,
            staleTime: 30 * 1000,
        })),
    });

    const counts = {} as Record<LeadKpiMetric, number | undefined>;
    LEAD_KPI_METRICS.forEach((metric, i) => {
        counts[metric] = results[i]?.data;
    });

    return { counts, isLoading: results.some((r) => r.isLoading) };
}
