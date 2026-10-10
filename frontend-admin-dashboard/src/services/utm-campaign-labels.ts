import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_UTM_CAMPAIGNS, UTM_CAMPAIGN_LABELS } from '@/constants/urls';

/**
 * Names for utm_campaign values. Ad platforms identify a campaign only by id —
 * Google's lead form webhook sends "22173284076" — so the admin names each id
 * once and every list, filter and report shows the name. Filters and stored
 * rows keep the id, which is why a rename also applies to old leads.
 */
export type UtmCampaignLabels = Record<string, string>;

/** One campaign an ad platform has sent leads from (snake_case: the API shape). */
export interface UtmCampaignRow {
    campaign: string;
    people: number;
    first_seen: string | null;
    last_seen: string | null;
    name: string | null;
}

export const utmCampaignLabelsQueryKey = (instituteId: string) =>
    ['utm-campaign-labels', instituteId] as const;

export const utmCampaignsQueryKey = (instituteId: string, source: string, medium: string) =>
    ['utm-campaigns', instituteId, source, medium] as const;

/** Never rejects: names are decoration, and every list must render without them. */
export const fetchUtmCampaignLabels = async (instituteId: string): Promise<UtmCampaignLabels> => {
    try {
        const res = await authenticatedAxiosInstance.get(UTM_CAMPAIGN_LABELS, {
            params: { instituteId },
        });
        const labels = res.data?.labels;
        return labels && typeof labels === 'object' ? (labels as UtmCampaignLabels) : {};
    } catch {
        return {};
    }
};

/** Merge names in; a blank name removes that campaign's name. Returns the full map. */
export const saveUtmCampaignLabels = async (
    instituteId: string,
    labels: UtmCampaignLabels
): Promise<UtmCampaignLabels> => {
    const res = await authenticatedAxiosInstance.put(
        UTM_CAMPAIGN_LABELS,
        { labels },
        { params: { instituteId } }
    );
    return (res.data?.labels ?? {}) as UtmCampaignLabels;
};

export const fetchUtmCampaigns = async (
    instituteId: string,
    source: string,
    medium: string
): Promise<UtmCampaignRow[]> => {
    const res = await authenticatedAxiosInstance.get(GET_UTM_CAMPAIGNS, {
        params: { instituteId, source, medium },
    });
    return Array.isArray(res.data) ? (res.data as UtmCampaignRow[]) : [];
};
