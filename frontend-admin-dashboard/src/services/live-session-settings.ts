import { GET_INSTITUTE_SETTING_DATA, SAVE_INSTITUTE_SETTING } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { WaitingRoomType } from '@/routes/study-library/live-session/-constants/enums';

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

/** How guest learners are admitted to a Vacademy Meet (BBB) live class. */
export type LiveSessionGuestPolicy = 'ALWAYS_ACCEPT' | 'ASK_MODERATOR' | 'ALWAYS_DENY';

/** Zoom registration approval: 0 = auto-approve, 1 = manual, 2 = no registration. */
export type ZoomApprovalType = '0' | '1' | '2';
/** Zoom audio options. */
export type ZoomAudioOption = 'both' | 'telephony' | 'voip';
/** Zoom automatic-recording options. */
export type ZoomAutoRecordingOption = 'cloud' | 'local' | 'none';

export interface LiveSessionSettings {
    /** Per-platform allow-list. Missing key is treated as `true` (allowed). */
    allowedPlatforms: Partial<Record<PlatformKey, boolean>>;
    /**
     * Platform pre-selected in the "Live Stream Platform" dropdown on new live
     * classes (single-class step 1 and the bulk grid's default for new rows).
     * Must be one of the allowed platforms — the settings UI keeps it in sync
     * and the forms fall back to `'other'` if it ever points at a hidden
     * platform. Admins can still change it per class.
     */
    defaultPlatform: PlatformKey;
    /**
     * Whether learners can submit feedback after a session. Acts as the master
     * feature flag: when `false`, the entire "Learner Feedback" card is hidden
     * from both the single-class and bulk scheduling flows (admins can't turn
     * feedback on per session), and new classes never collect feedback.
     */
    feedbackEnabled: boolean;
    /**
     * Default value for the per-session "Learner Feedback" toggle. When `true`,
     * new live sessions start with post-session feedback collection turned ON
     * (admins can still flip it off per session). Applies to single and bulk
     * scheduling. Only takes effect while `feedbackEnabled` is `true`.
     */
    defaultFeedbackEnabled: boolean;
    /**
     * Default value for the per-session "Make feedback compulsory" toggle.
     * When `true`, new live sessions start with feedback marked as compulsory
     * (allow_skip = false). Admins can still flip the toggle per session.
     */
    defaultFeedbackCompulsory: boolean;
    /**
     * Default value for the per-session "Enable Waiting Room or Pre-Joining"
     * toggle on new live-class forms (single-class step 1 and the bulk grid's
     * shared options). Admins can still flip it per class.
     */
    defaultWaitingRoomEnabled: boolean;
    /**
     * Default waiting-room behaviour pre-filled on new live classes:
     * `WAITING_ROOM` shows a waiting-room screen, `PRE_JOINING` lets learners
     * join the live class directly during the pre-start window.
     */
    defaultWaitingRoomType: WaitingRoomType;
    /**
     * Default "open waiting room before" duration in minutes, stored as a
     * string to match the select option values (e.g. `'15'`). Pre-filled on
     * new live classes; admins can still change it per class.
     */
    defaultWaitingRoomTime: string;
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
    /**
     * Whether the "Process Recording" entry point appears next to each BBB
     * recording. When `false`, admins/teachers don't see the transcribe
     * button (and so can't kick off Whisper jobs). Existing transcripts on
     * already-processed recordings remain viewable — only the *new*
     * processing entry point is hidden. Default is OFF so transcription
     * stays an opt-in feature an admin has to explicitly enable.
     */
    recordingTranscriptionEnabled: boolean;
    /**
     * "LMS Connection" — bridges live classes into course content (the LMS).
     * `recordingAddToCourseEnabled` shows/hides the per-recording "Add to
     * course" action on the session view page; `classMaterialsEnabled`
     * shows/hides the Class Materials card (PDF/video upload → chapter).
     * Both default OFF (opt-in per institute); turning one off hides only
     * the entry point — content already linked stays in its chapters.
     */
    lmsConnection: {
        recordingAddToCourseEnabled: boolean;
        classMaterialsEnabled: boolean;
    };
    /**
     * Defaults for the "Vacademy Meet recording & controls" block. These only
     * affect live classes whose platform is Vacademy Meet (BBB); other
     * platforms ignore them. Pre-filled on new single-class and bulk forms;
     * admins can still change them per class.
     */
    /** Default "record the session" toggle. */
    defaultBbbRecordEnabled: boolean;
    /** Default "auto-start recording" toggle (only meaningful when recording is on). */
    defaultBbbAutoStartRecording: boolean;
    /** Default "mute participants on join" toggle. */
    defaultBbbMuteOnStart: boolean;
    /** Default "only host can share webcam" toggle. */
    defaultBbbWebcamsOnlyForModerator: boolean;
    /** Default guest admission policy. */
    defaultBbbGuestPolicy: LiveSessionGuestPolicy;
    /**
     * Defaults for the "Notifications" block (channels + triggers) applied to
     * new live classes in both single-class step 2 and the bulk grid. Admins
     * can still change them per class.
     */
    /** Default "Notify via Email" channel. */
    defaultNotifyByEmail: boolean;
    /** Default "Notify via WhatsApp" channel. */
    defaultNotifyByWhatsapp: boolean;
    /** Default "Notify via Push Notification" channel. */
    defaultNotifyByPush: boolean;
    /** Default "Notify via System Notification" channel. */
    defaultNotifyBySystem: boolean;
    /** Default trigger: notify when the live class is created. */
    defaultNotifyOnCreate: boolean;
    /** Default trigger: notify when the class goes live. */
    defaultNotifyOnLive: boolean;
    /** Default trigger: notify when attendance is marked (present/absent). */
    defaultNotifyOnAttendance: boolean;
    /**
     * Default "notify before class" reminder offset, e.g. `'30m'` or `'1h'`.
     * Empty string means no reminder is pre-seeded. When set, new classes start
     * with one reminder at this offset (admins can add/remove more).
     */
    defaultNotifyBeforeReminder: string;
    /**
     * Zoom meeting defaults, pre-filled in the single-class Zoom settings panel.
     * They only apply to single-class live sessions hosted on Zoom with a
     * connected account — bulk scheduling has no Zoom provisioning. Field names
     * mirror the Zoom REST "settings" object. Admins can still change them per
     * class.
     */
    /** Default "enable waiting room". */
    defaultZoomWaitingRoom: boolean;
    /** Default "allow join before host". */
    defaultZoomJoinBeforeHost: boolean;
    /** Default "require Zoom login to join". */
    defaultZoomMeetingAuthentication: boolean;
    /** Default registration approval type. */
    defaultZoomApprovalType: ZoomApprovalType;
    /** Default "mute participants on entry". */
    defaultZoomMuteUponEntry: boolean;
    /** Default "start host video on". */
    defaultZoomHostVideo: boolean;
    /** Default "start participant video on". */
    defaultZoomParticipantVideo: boolean;
    /** Default audio option. */
    defaultZoomAudio: ZoomAudioOption;
    /** Default automatic-recording option. */
    defaultZoomAutoRecording: ZoomAutoRecordingOption;
    /** Default "enable breakout rooms". */
    defaultZoomBreakoutRoom: boolean;
    /** Default "start in focus mode". */
    defaultZoomFocusMode: boolean;
    /** Default "allow join from multiple devices". */
    defaultZoomAllowMultipleDevices: boolean;
    /** Default "add identity watermark". */
    defaultZoomWatermark: boolean;
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
    defaultPlatform: 'other',
    feedbackEnabled: true,
    defaultFeedbackEnabled: true,
    defaultFeedbackCompulsory: false,
    defaultWaitingRoomEnabled: false,
    defaultWaitingRoomType: WaitingRoomType.WAITING_ROOM,
    defaultWaitingRoomTime: '15',
    bulkScheduleEnabled: true,
    singleScheduleEnabled: true,
    recurringEnabled: true,
    defaultDayButtonEnabled: true,
    customActionButtonEnabled: true,
    defaultTimeZone: '',
    defaultDailyAttendanceCounting: false,
    descriptionEnabled: true,
    recordingTranscriptionEnabled: false,
    lmsConnection: {
        recordingAddToCourseEnabled: false,
        classMaterialsEnabled: false,
    },
    defaultBbbRecordEnabled: true,
    defaultBbbAutoStartRecording: false,
    defaultBbbMuteOnStart: true,
    defaultBbbWebcamsOnlyForModerator: false,
    defaultBbbGuestPolicy: 'ALWAYS_ACCEPT',
    defaultNotifyByEmail: false,
    defaultNotifyByWhatsapp: false,
    defaultNotifyByPush: false,
    defaultNotifyBySystem: false,
    defaultNotifyOnCreate: false,
    defaultNotifyOnLive: true,
    defaultNotifyOnAttendance: false,
    defaultNotifyBeforeReminder: '',
    defaultZoomWaitingRoom: true,
    defaultZoomJoinBeforeHost: false,
    defaultZoomMeetingAuthentication: false,
    defaultZoomApprovalType: '2',
    defaultZoomMuteUponEntry: true,
    defaultZoomHostVideo: false,
    defaultZoomParticipantVideo: false,
    defaultZoomAudio: 'both',
    defaultZoomAutoRecording: 'cloud',
    defaultZoomBreakoutRoom: false,
    defaultZoomFocusMode: false,
    defaultZoomAllowMultipleDevices: false,
    defaultZoomWatermark: false,
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
            lmsConnection: {
                ...DEFAULT_LIVE_SESSION_SETTINGS.lmsConnection,
                ...(partial.lmsConnection ?? {}),
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
