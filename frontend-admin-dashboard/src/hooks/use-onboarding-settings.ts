/**
 * useOnboardingSettings — single source of truth for the Onboarding Flows
 * feature toggle.
 *
 * Reads ONBOARDING_SETTING from the backend (same key saved by
 * OnboardingSettings.tsx). All onboarding-flow UI (sidebar entry, flow list
 * route, student side-view tab) must gate itself behind { enabled } from
 * this hook.
 *
 * Usage:
 *   const { enabled } = useOnboardingSettings();
 *   if (!enabled) return null;
 */

import { useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_INSITITUTE_SETTINGS } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';

// ── Types ──────────────────────────────────────────────────────────────────

export interface OnboardingSettingsConfig {
    /** Institute-wide master toggle for the Onboarding Flows feature. */
    enabled: boolean;
}

export const ONBOARDING_SETTINGS_DEFAULTS: OnboardingSettingsConfig = {
    enabled: false,
};

// ── Fetcher ──────────────────────────────────────────────────────────────────

const SETTING_KEY = 'ONBOARDING_SETTING';

async function fetchOnboardingSettings(): Promise<OnboardingSettingsConfig> {
    const instituteId = getCurrentInstituteId();
    if (!instituteId) return ONBOARDING_SETTINGS_DEFAULTS;
    try {
        const response = await authenticatedAxiosInstance({
            method: 'GET',
            url: GET_INSITITUTE_SETTINGS,
            params: { instituteId, settingKey: SETTING_KEY },
        });
        // GET returns the SettingDto itself ({key, name, data}) — response.data IS
        // the SettingDto, so its content is one level down at response.data.data
        // (matches GuardianSettings.tsx's fetchGuardianSettings, verified working).
        const data: OnboardingSettingsConfig | undefined = response.data?.data;
        if (!data) return ONBOARDING_SETTINGS_DEFAULTS;
        // Merge with defaults so any newly added keys are present even if not
        // yet saved (backward-compatible config evolution).
        return { ...ONBOARDING_SETTINGS_DEFAULTS, ...data };
    } catch {
        return ONBOARDING_SETTINGS_DEFAULTS;
    }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns the institute's onboarding-flow settings config.
 * Falls back to safe defaults on error or missing setting so callers never
 * need to handle undefined.
 *
 * @param options.skip  Set to true in contexts where onboarding settings are
 *                      irrelevant (e.g. learner portal). Skips the network request.
 */
export function useOnboardingSettings(options?: { skip?: boolean }): OnboardingSettingsConfig & {
    isLoading: boolean;
} {
    const { data, isLoading } = useQuery({
        queryKey: ['onboarding-settings-config'],
        queryFn: fetchOnboardingSettings,
        staleTime: 5 * 60 * 1000, // 5 minutes — settings change rarely
        gcTime: 10 * 60 * 1000,
        enabled: !options?.skip,
    });

    return {
        ...(data ?? ONBOARDING_SETTINGS_DEFAULTS),
        isLoading,
    };
}
