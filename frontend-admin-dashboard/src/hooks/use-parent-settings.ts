/**
 * useParentSettings — single source of truth for guardian-linking config.
 *
 * Reads PARENT_SETTING from the backend (same key saved by GuardianSettings.tsx).
 * All guardian-linking UI must gate itself behind { enabled } from this hook.
 *
 * Usage:
 *   const { enabled } = useParentSettings();
 *   if (!enabled) return null;
 */

import { useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_INSITITUTE_SETTINGS } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';

// ── Types (mirror ParentSettingsData in GuardianSettings.tsx) ────────────────

export interface ParentSettingsConfig {
    /** Institute-wide master toggle for guardian-student linking. */
    enabled: boolean;
}

export const PARENT_SETTINGS_DEFAULTS: ParentSettingsConfig = {
    enabled: false,
};

// ── Fetcher ──────────────────────────────────────────────────────────────────

const SETTING_KEY = 'PARENT_SETTING';

async function fetchParentSettings(): Promise<ParentSettingsConfig> {
    const instituteId = getCurrentInstituteId();
    if (!instituteId) return PARENT_SETTINGS_DEFAULTS;
    try {
        const response = await authenticatedAxiosInstance({
            method: 'GET',
            url: GET_INSITITUTE_SETTINGS,
            params: { instituteId, settingKey: SETTING_KEY },
        });
        const data: ParentSettingsConfig | undefined = response.data?.data?.[SETTING_KEY]?.data;
        if (!data) return PARENT_SETTINGS_DEFAULTS;
        // Merge with defaults so any newly added keys are present even if not
        // yet saved (backward-compatible config evolution).
        return { ...PARENT_SETTINGS_DEFAULTS, ...data };
    } catch {
        return PARENT_SETTINGS_DEFAULTS;
    }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns the institute's guardian-linking settings config.
 * Falls back to safe defaults on error or missing setting so callers never
 * need to handle undefined.
 *
 * @param options.skip  Set to true in contexts where guardian settings are irrelevant
 *                      (e.g. learner portal). Skips the network request.
 */
export function useParentSettings(options?: { skip?: boolean }): ParentSettingsConfig & {
    isLoading: boolean;
} {
    const { data, isLoading } = useQuery({
        queryKey: ['parent-settings-config'],
        queryFn: fetchParentSettings,
        staleTime: 5 * 60 * 1000, // 5 minutes — settings change rarely
        gcTime: 10 * 60 * 1000,
        enabled: !options?.skip,
    });

    return {
        ...(data ?? PARENT_SETTINGS_DEFAULTS),
        isLoading,
    };
}
