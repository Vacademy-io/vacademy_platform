/**
 * useLeadDedupSettings — reads the institute lead-uniqueness config subtree
 * persisted at LEAD_SETTING.data.dedup:
 *
 *   { "enabled": false, "field": "EMAIL", "scope": "CAMPAIGN" }
 *
 * Mirrors the backend defaults in
 * admin_core_service/.../features/audience/service/LeadDedupSettingService.java.
 *
 * Read-only: the Settings card (LeadDedupSettings.tsx) owns the write path and
 * read-modify-writes the WHOLE LEAD_SETTING data object so sibling keys
 * (enabled, scoringWeights, reports, workbench, …) are never clobbered.
 */
import { useQuery } from '@tanstack/react-query';
import { fetchLeadSettingRawData } from '@/hooks/use-lead-report-settings';

export type LeadDedupField = 'EMAIL' | 'PHONE';
export type LeadDedupScope = 'CAMPAIGN' | 'INSTITUTE';

/** Raw shape persisted at LEAD_SETTING.data.dedup (backend contract). */
export interface LeadDedupSettingsSubtree {
    enabled?: boolean;
    field?: LeadDedupField;
    scope?: LeadDedupScope;
}

export interface LeadDedupSettings {
    enabled: boolean;
    field: LeadDedupField;
    scope: LeadDedupScope;
}

export const LEAD_DEDUP_SETTINGS_DEFAULTS: LeadDedupSettings = {
    enabled: false,
    field: 'EMAIL',
    scope: 'CAMPAIGN',
};

export const LEAD_DEDUP_SETTINGS_QUERY_KEY = ['lead-dedup-settings'];

function withDefaults(subtree: LeadDedupSettingsSubtree | undefined): LeadDedupSettings {
    return {
        enabled: subtree?.enabled ?? LEAD_DEDUP_SETTINGS_DEFAULTS.enabled,
        field: subtree?.field === 'PHONE' ? 'PHONE' : LEAD_DEDUP_SETTINGS_DEFAULTS.field,
        scope: subtree?.scope === 'INSTITUTE' ? 'INSTITUTE' : LEAD_DEDUP_SETTINGS_DEFAULTS.scope,
    };
}

export async function fetchLeadDedupSettings(): Promise<LeadDedupSettings> {
    try {
        const raw = await fetchLeadSettingRawData();
        return withDefaults(raw['dedup'] as LeadDedupSettingsSubtree | undefined);
    } catch {
        return LEAD_DEDUP_SETTINGS_DEFAULTS;
    }
}

/**
 * Returns the institute's lead-dedup settings, falling back to disabled
 * defaults on error / missing config so callers never handle undefined.
 */
export function useLeadDedupSettings(options?: { skip?: boolean }): {
    settings: LeadDedupSettings;
    isLoading: boolean;
} {
    const { data, isLoading } = useQuery({
        queryKey: LEAD_DEDUP_SETTINGS_QUERY_KEY,
        queryFn: fetchLeadDedupSettings,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        enabled: !options?.skip,
    });
    return { settings: data ?? LEAD_DEDUP_SETTINGS_DEFAULTS, isLoading };
}
