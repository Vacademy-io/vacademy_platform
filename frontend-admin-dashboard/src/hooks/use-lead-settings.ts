/**
 * useLeadSettings — single source of truth for all lead-system config.
 *
 * Reads LEAD_SETTING from the backend (same key saved by LeadSettings.tsx).
 * All lead UI (score badges, tier filters, sidebar tab, walk-in button) must
 * gate itself behind { enabled } from this hook.
 *
 * Usage:
 *   const { enabled, showScoreInEnquiryTable } = useLeadSettings();
 *   if (!enabled) return null;
 */

import { useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_INSITITUTE_SETTINGS } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';

// ── Types (mirror LeadSettingsData in LeadSettings.tsx) ──────────────────────

export interface LeadScoringWeights {
    sourceQuality: number;
    profileCompleteness: number;
    recency: number;
    engagement: number;
}

export interface LeadSettingsConfig {
    /** Institute-wide master toggle. When false, all lead UI is hidden. */
    enabled: boolean;

    scoringWeights: LeadScoringWeights;

    /** Days before recency score starts decaying. */
    recencyDecayDays: number;

    /** Per-table badge visibility flags. */
    showScoreInEnquiryTable: boolean;
    showScoreInContactsTable: boolean;
    showScoreInStudentsTable: boolean;
}

export const LEAD_SETTINGS_DEFAULTS: LeadSettingsConfig = {
    enabled: true,
    scoringWeights: {
        sourceQuality: 25,
        profileCompleteness: 30,
        recency: 25,
        engagement: 20,
    },
    recencyDecayDays: 30,
    showScoreInEnquiryTable: true,
    showScoreInContactsTable: true,
    showScoreInStudentsTable: true,
};

// ── Fetcher ──────────────────────────────────────────────────────────────────

const SETTING_KEY = 'LEAD_SETTING';

async function fetchLeadSettings(): Promise<LeadSettingsConfig> {
    const instituteId = getCurrentInstituteId();
    if (!instituteId) return LEAD_SETTINGS_DEFAULTS;
    try {
        const response = await authenticatedAxiosInstance({
            method: 'GET',
            url: GET_INSITITUTE_SETTINGS,
            params: { instituteId, settingKey: SETTING_KEY },
        });
        const data: LeadSettingsConfig | undefined = response.data?.data?.[SETTING_KEY]?.data;
        if (!data) return LEAD_SETTINGS_DEFAULTS;
        // Merge with defaults so any newly added keys are present even if not
        // yet saved (backward-compatible config evolution).
        return { ...LEAD_SETTINGS_DEFAULTS, ...data };
    } catch {
        return LEAD_SETTINGS_DEFAULTS;
    }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns the institute's lead settings config.
 * Falls back to safe defaults on error or missing setting so callers never
 * need to handle undefined.
 *
 * @param options.skip  Set to true in contexts where lead settings are irrelevant
 *                      (e.g. learner portal). Skips the network request.
 */
export function useLeadSettings(options?: { skip?: boolean }): LeadSettingsConfig & {
    isLoading: boolean;
} {
    const { data, isLoading } = useQuery({
        queryKey: ['lead-settings-config'],
        queryFn: fetchLeadSettings,
        staleTime: 5 * 60 * 1000, // 5 minutes — settings change rarely
        gcTime: 10 * 60 * 1000,
        enabled: !options?.skip,
    });

    return {
        ...(data ?? LEAD_SETTINGS_DEFAULTS),
        isLoading,
    };
}
