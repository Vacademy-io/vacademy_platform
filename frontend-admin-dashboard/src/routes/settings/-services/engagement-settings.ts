import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_INSITITUTE_SETTINGS } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';

/**
 * ENGAGEMENT_SETTING — the institute-level knobs for daily engagement.
 *
 * Every value has a working default on the server (EngagementSettingsService), so an
 * institute that never opens this screen behaves sensibly. The keys and defaults here
 * MUST stay in lock-step with that service.
 */
export const ENGAGEMENT_SETTING_KEY = 'ENGAGEMENT_SETTING';

export interface EngagementSettings {
    /** Tasks a learner is shown per day ACROSS ALL their batches. */
    dailyItemCap: number;
    /** Scroll depth needed for a reading to count, 0-100. */
    minScrollPercent: number;
    /** Seconds on the page needed for a reading to count. */
    minReadSeconds: number;
    /**
     * Whether a self-reported game score may earn score-proportional points on top of
     * completion points. Off by default: the page reports its own score.
     */
    allowUnverifiedScoreBonus: boolean;
}

export const DEFAULT_ENGAGEMENT_SETTINGS: EngagementSettings = {
    dailyItemCap: 5,
    minScrollPercent: 80,
    minReadSeconds: 15,
    allowUnverifiedScoreBonus: false,
};

const SAVE_URL = GET_INSITITUTE_SETTINGS.replace('/get', '/save-setting');

const clamp = (v: unknown, d: number, min: number, max: number) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return d;
    return Math.max(min, Math.min(max, Math.round(n)));
};

const extractBlob = (responseData: unknown): Partial<EngagementSettings> | null => {
    const obj = (v: unknown): Record<string, unknown> | null =>
        v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
    const r = obj(responseData);
    const keyed = obj(r?.[ENGAGEMENT_SETTING_KEY])?.data;
    const nested = obj(obj(r?.data)?.[ENGAGEMENT_SETTING_KEY])?.data;
    return (keyed ?? nested ?? r?.data ?? null) as Partial<EngagementSettings> | null;
};

export const normalizeEngagementSettings = (
    raw: Partial<EngagementSettings> | null | undefined
): EngagementSettings => ({
    dailyItemCap: clamp(raw?.dailyItemCap, DEFAULT_ENGAGEMENT_SETTINGS.dailyItemCap, 1, 50),
    minScrollPercent: clamp(
        raw?.minScrollPercent,
        DEFAULT_ENGAGEMENT_SETTINGS.minScrollPercent,
        0,
        100
    ),
    minReadSeconds: clamp(raw?.minReadSeconds, DEFAULT_ENGAGEMENT_SETTINGS.minReadSeconds, 0, 3600),
    allowUnverifiedScoreBonus: raw?.allowUnverifiedScoreBonus === true,
});

export const getEngagementSettings = async (): Promise<EngagementSettings> => {
    try {
        const instituteId = getCurrentInstituteId();
        const response = await authenticatedAxiosInstance({
            method: 'GET',
            url: GET_INSITITUTE_SETTINGS,
            params: { instituteId, settingKey: ENGAGEMENT_SETTING_KEY },
        });
        return normalizeEngagementSettings(extractBlob(response.data));
    } catch {
        return DEFAULT_ENGAGEMENT_SETTINGS;
    }
};

export const saveEngagementSettings = async (settings: EngagementSettings): Promise<void> => {
    const instituteId = getCurrentInstituteId();
    await authenticatedAxiosInstance.post(
        SAVE_URL,
        { setting_name: 'Daily Engagement', setting_data: normalizeEngagementSettings(settings) },
        { params: { instituteId, settingKey: ENGAGEMENT_SETTING_KEY } }
    );
};
