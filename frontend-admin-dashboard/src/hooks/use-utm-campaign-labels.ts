import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import {
    fetchUtmCampaignLabels,
    utmCampaignLabelsQueryKey,
    type UtmCampaignLabels,
} from '@/services/utm-campaign-labels';

const NO_LABELS: UtmCampaignLabels = {};

/** The open institute, or '' when it can't be read (no storage, e.g. in tests). */
function currentInstituteIdSafe(): string {
    try {
        return getCurrentInstituteId() ?? '';
    } catch {
        return '';
    }
}

/**
 * The institute's campaign names, and `labelFor(value)`: the admin-given name for
 * a utm_campaign value, or the value itself when it has none. One cached request
 * however many cells and dropdowns use it; saving names invalidates the key.
 * Pass `instituteId` when the caller already has it; otherwise the open institute.
 */
export function useUtmCampaignLabels(instituteIdOverride?: string) {
    const instituteId = instituteIdOverride || currentInstituteIdSafe();
    const { data } = useQuery({
        queryKey: utmCampaignLabelsQueryKey(instituteId),
        queryFn: () => fetchUtmCampaignLabels(instituteId),
        enabled: !!instituteId,
        staleTime: 5 * 60 * 1000,
    });
    const labels = data ?? NO_LABELS;
    const labelFor = useCallback(
        (value: string | null | undefined): string => (value ? labels[value] ?? value : ''),
        [labels]
    );
    return { labels, labelFor };
}
