import { GET_INSTITUTE_SETTING_DATA, SAVE_INSTITUTE_SETTING } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';

/**
 * Institute-setting key for the mentorship notification configuration. The blob
 * mirrors what {@code MentorshipNotificationService} on admin_core_service reads,
 * so the field names here are the exact snake_case keys the backend looks up
 * (e.g. `system_alert`, `notify_student`). When the setting is absent the backend
 * falls back to code defaults (everything ON), which these defaults mirror.
 */
export const SETTING_KEY_MENTORSHIP = 'MENTORSHIP_SETTING';

/** Channels a mentorship event can be delivered on. */
export interface MentorshipChannelToggles {
    email: boolean;
    system_alert: boolean;
    push: boolean;
}

export interface MentorshipAssignmentSettings extends MentorshipChannelToggles {
    /** Notify the student that a mentor was assigned to them. */
    notify_student: boolean;
    /** Notify the mentor that a new mentee was assigned to them. */
    notify_mentor: boolean;
}

export interface MentorshipSettings {
    /** A mentor↔student assignment was created (manual or round-robin). */
    assignment: MentorshipAssignmentSettings;
    /**
     * A mentorship 1:1 session was booked. Email confirmation is already sent by
     * the booking page's own confirmation settings, so only the in-app + push
     * channels are added here.
     */
    booking: Pick<MentorshipChannelToggles, 'system_alert' | 'push'>;
    /** A mentorship 1:1 session was cancelled. */
    cancellation: MentorshipChannelToggles;
}

export const DEFAULT_MENTORSHIP_SETTINGS: MentorshipSettings = {
    assignment: {
        email: true,
        system_alert: true,
        push: true,
        notify_student: true,
        notify_mentor: true,
    },
    booking: {
        system_alert: true,
        push: true,
    },
    cancellation: {
        email: true,
        system_alert: true,
        push: true,
    },
};

const getInstituteId = (): string => {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const instituteIds = Object.keys(tokenData?.authorities || {});
    if (instituteIds.length === 0) throw new Error('No institute ID found in token');
    return instituteIds[0]!;
};

export const getMentorshipSettings = async (): Promise<MentorshipSettings> => {
    try {
        const instituteId = getInstituteId();
        const response = await authenticatedAxiosInstance.get(GET_INSTITUTE_SETTING_DATA, {
            params: { instituteId, settingKey: SETTING_KEY_MENTORSHIP },
        });
        // /data returns the persisted blob directly (or null if never saved).
        // Merge with defaults so any newly-added flag is treated as enabled.
        const raw = response.data;
        if (!raw || typeof raw !== 'object') return DEFAULT_MENTORSHIP_SETTINGS;
        const partial = raw as Partial<MentorshipSettings>;
        return {
            assignment: { ...DEFAULT_MENTORSHIP_SETTINGS.assignment, ...(partial.assignment ?? {}) },
            booking: { ...DEFAULT_MENTORSHIP_SETTINGS.booking, ...(partial.booking ?? {}) },
            cancellation: { ...DEFAULT_MENTORSHIP_SETTINGS.cancellation, ...(partial.cancellation ?? {}) },
        };
    } catch (err) {
        console.error('Failed to load mentorship settings, using defaults', err);
        return DEFAULT_MENTORSHIP_SETTINGS;
    }
};

export const saveMentorshipSettings = async (settings: MentorshipSettings): Promise<void> => {
    const instituteId = getInstituteId();
    // GenericSettingRequest uses @JsonNaming(SnakeCaseStrategy) — the wrapper keys
    // must be snake_case (setting_name / setting_data) or the save silently no-ops.
    await authenticatedAxiosInstance.post(
        SAVE_INSTITUTE_SETTING,
        {
            setting_name: 'Mentorship Settings',
            setting_data: settings,
        },
        {
            params: { instituteId, settingKey: SETTING_KEY_MENTORSHIP },
        }
    );
};
