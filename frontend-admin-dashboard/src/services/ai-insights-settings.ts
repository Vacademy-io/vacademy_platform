import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_INSITITUTE_SETTINGS, SAVE_INSTITUTE_SETTING } from '@/constants/urls';
import { getInstituteId } from '@/constants/helper';

/**
 * Institute policy for the LLM-analytics insight reports the pipeline already
 * produces per attempt (`activity_log.processed_json`).
 *
 * Covers the admin side only. Learner visibility is governed by the existing
 * canViewReports permission that already gates My Reports — a deliberate decision
 * not to introduce a second learner permission for one tab inside a section the
 * institute has already chosen to open or close.
 */
export interface AiInsightsSettingsData {
    /** Show the per-attempt report to staff in the admin activity-log dialog. */
    adminActivityInsightsEnabled: boolean;
}

export const AI_INSIGHTS_SETTING_KEY = 'AI_INSIGHTS_SETTING';

export const DEFAULT_AI_INSIGHTS_SETTINGS: AiInsightsSettingsData = {
    adminActivityInsightsEnabled: false,
};

/** Older/partial blobs must stay safe to read, so everything falls back to the default. */
const mergeWithDefaults = (
    partial: Partial<AiInsightsSettingsData> | null | undefined
): AiInsightsSettingsData => ({
    ...DEFAULT_AI_INSIGHTS_SETTINGS,
    ...(partial ?? {}),
});

export const getAiInsightsSettings = async (): Promise<AiInsightsSettingsData> => {
    try {
        const response = await authenticatedAxiosInstance({
            method: 'GET',
            url: GET_INSITITUTE_SETTINGS,
            params: { instituteId: getInstituteId(), settingKey: AI_INSIGHTS_SETTING_KEY },
        });
        return mergeWithDefaults(response.data?.data);
    } catch {
        // An institute that has never saved the key 404s/errors here. That is the
        // normal state, not a failure — and it means "off", which is also the
        // fail-safe answer if the settings call itself is broken.
        return { ...DEFAULT_AI_INSIGHTS_SETTINGS };
    }
};

export const saveAiInsightsSettings = async (data: AiInsightsSettingsData): Promise<void> => {
    await authenticatedAxiosInstance({
        method: 'POST',
        url: SAVE_INSTITUTE_SETTING,
        params: { instituteId: getInstituteId(), settingKey: AI_INSIGHTS_SETTING_KEY },
        // snake_case: GenericSettingRequest is annotated SnakeCaseStrategy.
        data: {
            setting_name: 'AI Insights',
            setting_data: data,
        },
    });
};
