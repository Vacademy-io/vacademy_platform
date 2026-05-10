import { GET_INSTITUTE_SETTING_DATA, SAVE_INSTITUTE_SETTING } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';

export const SETTING_KEY_LIVE_SESSION = 'LIVE_SESSION_SETTING';

/**
 * Stable identifiers used in the LiveSessionSettings document. They map to the
 * `value` strings already used by `STREAMING_OPTIONS` so the schedule UI can
 * filter directly without translation.
 */
export const PLATFORM_KEYS = [
    'youtube',
    'google meet',
    'zoom',
    'zoho',
    'bbb',
    'other',
] as const;
export type PlatformKey = (typeof PLATFORM_KEYS)[number];

export interface LiveSessionSettings {
    /** Per-platform allow-list. Missing key is treated as `true` (allowed). */
    allowedPlatforms: Partial<Record<PlatformKey, boolean>>;
    /** Whether learners can submit feedback after a session. */
    feedbackEnabled: boolean;
    /** Whether the "Bulk Schedule" mode appears in step 1. */
    bulkScheduleEnabled: boolean;
    /** Whether the "Single Class" mode appears in step 1. Cannot be false at the same time as bulk. */
    singleScheduleEnabled: boolean;
    /** Whether the "Recurring Class" radio appears under Single Class mode. */
    recurringEnabled: boolean;
    /** Whether the day-level default class link card renders inside recurring days. */
    defaultDayButtonEnabled: boolean;
    /** Whether the page-level "Custom Action Button" card renders in step 1. */
    customActionButtonEnabled: boolean;
    /**
     * IANA timezone (e.g. `Asia/Kolkata`) used as the default in new live-class
     * forms. Empty string means "use the browser's timezone". Admins can still
     * change it per-class while scheduling.
     */
    defaultTimeZone: string;
    /**
     * Default value for the per-session "Daily attendance" toggle on a recurring
     * class. When `true`, every newly added session inside a recurring schedule
     * starts with daily attendance counting enabled. Admins can still flip the
     * toggle per session while scheduling.
     */
    defaultDailyAttendanceCounting: boolean;
    /**
     * Whether the Description input is shown in live-class scheduling flows
     * (single-class step 1, bulk default description, and per-row description).
     * When `false`, all description UI is hidden and saved descriptions remain
     * empty.
     */
    descriptionEnabled: boolean;
}

export const DEFAULT_LIVE_SESSION_SETTINGS: LiveSessionSettings = {
    allowedPlatforms: {
        youtube: true,
        'google meet': true,
        zoom: true,
        zoho: true,
        bbb: true,
        other: true,
    },
    feedbackEnabled: true,
    bulkScheduleEnabled: true,
    singleScheduleEnabled: true,
    recurringEnabled: true,
    defaultDayButtonEnabled: true,
    customActionButtonEnabled: true,
    defaultTimeZone: '',
    defaultDailyAttendanceCounting: false,
    descriptionEnabled: true,
};

const getInstituteId = (): string => {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const instituteIds = Object.keys(tokenData?.authorities || {});
    if (instituteIds.length === 0) throw new Error('No institute ID found in token');
    return instituteIds[0]!;
};

export const getLiveSessionSettings = async (): Promise<LiveSessionSettings> => {
    try {
        const instituteId = getInstituteId();
        const response = await authenticatedAxiosInstance.get(GET_INSTITUTE_SETTING_DATA, {
            params: { instituteId, settingKey: SETTING_KEY_LIVE_SESSION },
        });
        // The /data endpoint returns SettingDto.data directly — i.e. the
        // exact object we previously persisted, or null if the institute
        // hasn't saved this setting yet. We merge with defaults so any flag
        // that's been added since the last save is treated as enabled.
        const raw = response.data;
        if (!raw || typeof raw !== 'object') return DEFAULT_LIVE_SESSION_SETTINGS;
        const partial = raw as Partial<LiveSessionSettings>;
        return {
            ...DEFAULT_LIVE_SESSION_SETTINGS,
            ...partial,
            allowedPlatforms: {
                ...DEFAULT_LIVE_SESSION_SETTINGS.allowedPlatforms,
                ...(partial.allowedPlatforms ?? {}),
            },
        };
    } catch (err) {
        console.error('Failed to load live-session settings, using defaults', err);
        return DEFAULT_LIVE_SESSION_SETTINGS;
    }
};

export const saveLiveSessionSettings = async (settings: LiveSessionSettings): Promise<void> => {
    const instituteId = getInstituteId();
    // Backend GenericSettingRequest uses @JsonNaming(SnakeCaseStrategy) so the
    // wire format must be snake_case — sending camelCase here means
    // setting_data arrives as null and the save silently no-ops.
    await authenticatedAxiosInstance.post(
        SAVE_INSTITUTE_SETTING,
        {
            setting_name: 'Live Session Settings',
            setting_data: settings,
        },
        {
            params: { instituteId, settingKey: SETTING_KEY_LIVE_SESSION },
        }
    );
};
