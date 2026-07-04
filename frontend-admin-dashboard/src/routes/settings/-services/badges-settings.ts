import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_INSITITUTE_SETTINGS } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import {
    BADGES_REWARDS_SETTING_KEY,
    BadgeDefinitionConfig,
    BadgesRewardsConfig,
    DEFAULT_BADGE_CONFIG,
    DEFAULT_SCORING,
    ScoringConfig,
} from '../-constants/badge-config';

const SAVE_URL = GET_INSITITUTE_SETTINGS.replace('/get', '/save-setting');

const normalizeScoring = (raw: Partial<ScoringConfig> | undefined): ScoringConfig => {
    const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);
    return {
        activityPerDay: num(raw?.activityPerDay, DEFAULT_SCORING.activityPerDay),
        streakPerDay: num(raw?.streakPerDay, DEFAULT_SCORING.streakPerDay),
        liveClassAttended: num(raw?.liveClassAttended, DEFAULT_SCORING.liveClassAttended),
        courseCompletion: num(raw?.courseCompletion, DEFAULT_SCORING.courseCompletion),
        assessmentBestScore: num(raw?.assessmentBestScore, DEFAULT_SCORING.assessmentBestScore),
    };
};

/** Read the institute's full badge config (master toggle + scoring + badges), with defaults. */
export const getBadgesRewardsConfig = async (): Promise<{
    enabled: boolean;
    scoring: ScoringConfig;
    badges: BadgeDefinitionConfig[];
    publicShowFullNames: boolean;
}> => {
    const instituteId = getCurrentInstituteId();
    try {
        const response = await authenticatedAxiosInstance({
            method: 'GET',
            url: GET_INSITITUTE_SETTINGS,
            params: { instituteId, settingKey: BADGES_REWARDS_SETTING_KEY },
        });
        // SettingDto blob can be nested a couple of ways depending on the axios wrapper.
        // Probe the canonical shapes in the SAME order as services/display-settings.ts —
        // the real one is the bare `response.data.data` (NOT `[settingKey].data`).
        const blob = (response.data?.[BADGES_REWARDS_SETTING_KEY]?.data ??
            response.data?.data?.[BADGES_REWARDS_SETTING_KEY]?.data ??
            response.data?.data ??
            null) as BadgesRewardsConfig | null;
        const badges =
            Array.isArray(blob?.badges) && blob!.badges.length > 0
                ? blob!.badges
                : DEFAULT_BADGE_CONFIG.badges;
        // Master toggle defaults to OFF when absent — institutes must opt in.
        const enabled = blob?.enabled === true;
        const scoring = normalizeScoring(blob?.scoring);
        // Public leaderboard names default to anonymized (opt-in to show full names).
        const publicShowFullNames = blob?.publicShowFullNames === true;
        return { enabled, scoring, badges, publicShowFullNames };
    } catch (error) {
        console.error('Error fetching badge settings:', error);
        return {
            enabled: false,
            scoring: DEFAULT_SCORING,
            badges: DEFAULT_BADGE_CONFIG.badges,
            publicShowFullNames: false,
        };
    }
};

/** Badge list only (used by the student award picker). */
export const getBadgesSettings = async (): Promise<BadgeDefinitionConfig[]> => {
    return (await getBadgesRewardsConfig()).badges;
};

/** Whether the badges + leaderboard feature is enabled for this institute. */
export const getBadgesEnabled = async (): Promise<boolean> => {
    return (await getBadgesRewardsConfig()).enabled;
};

/** Persist the institute's badge config (master toggle + scoring + badges + public-names). */
export const saveBadgesSettings = async (
    badges: BadgeDefinitionConfig[],
    enabled: boolean,
    scoring: ScoringConfig,
    publicShowFullNames = false
): Promise<void> => {
    const instituteId = getCurrentInstituteId();
    const settingData: BadgesRewardsConfig = {
        version: 1,
        enabled,
        scoring,
        badges,
        publicShowFullNames,
    };
    await authenticatedAxiosInstance.post(
        SAVE_URL,
        { setting_name: 'Badges & Rewards', setting_data: settingData },
        { params: { instituteId, settingKey: BADGES_REWARDS_SETTING_KEY } }
    );
};
