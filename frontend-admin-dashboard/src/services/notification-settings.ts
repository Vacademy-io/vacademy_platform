import axios from 'axios';
import {
    NOTIFICATION_SETTINGS_BASE,
    GET_NOTIFICATION_SETTINGS_BY_INSTITUTE,
    GET_NOTIFICATION_DEFAULT_TEMPLATE,
} from '@/constants/urls';
import { getInstituteId } from '@/constants/helper';

export type NotificationSettingsResponse = {
    id: string | null;
    instituteId: string | null;
    settings: NotificationSettings;
    createdAt: string | null;
    updatedAt: string | null;
};

export type NotificationSettings = {
    community: {
        students_can_send: boolean;
        teachers_can_send?: boolean;
        admins_can_send?: boolean;
        allow_replies?: boolean;
        moderation_enabled?: boolean;
        allowed_tags: string[] | null;
    };
    dashboardPins: {
        students_can_create: boolean;
        teachers_can_create?: boolean;
        admins_can_create?: boolean;
        max_duration_hours: number;
        max_pins_per_user: number;
        require_approval: boolean;
    };
    systemAlerts: {
        students_can_send: boolean;
        teachers_can_send?: boolean;
        admins_can_send?: boolean;
        high_priority_roles: string[] | null;
        auto_dismiss_hours: number;
    };
    directMessages: {
        students_can_send: boolean;
        teachers_can_send: boolean;
        admins_can_send: boolean;
        allow_student_to_student: boolean;
        allow_replies: boolean;
        moderation_enabled: boolean;
    };
    streams: {
        students_can_send: boolean;
        teachers_can_send: boolean;
        admins_can_send: boolean;
        allow_during_class: boolean;
        auto_archive_hours: number;
    };
    resources: {
        students_can_upload: boolean;
        teachers_can_upload: boolean;
        admins_can_upload: boolean;
        allowed_folders: string[] | null;
        allowed_categories: string[] | null;
        max_file_size_mb: number;
    };
    general: {
        announcement_approval_required: boolean;
        max_announcements_per_day: number;
        allowed_mediums: string[] | null;
        default_timezone: string;
        retention_days: number;
        disabled_modes?: string[] | null;
    };
    emails?: Array<{
        id: string;
        email: string;
        type: string;
    }>;
    firebase?: FirebaseSettings;
};

export type FirebaseSettings = {
    enabled?: boolean;
    serviceAccountJson?: string | null;
    serviceAccountJsonBase64?: string | null;
};

export type FirebaseServiceAccountMinimal = {
    project_id: string;
    client_email: string;
    private_key: string;
};

// Admin UI copy for per-institute Firebase credentials
export const FIREBASE_CREDENTIALS_LABEL = 'Firebase Service Account JSON';

export const FIREBASE_CREDENTIALS_HELPER_TEXT =
    'Paste the exact JSON for this institute’s Firebase project. It’s required to send push notifications. Stored securely; only used by the notification service.';

export const FIREBASE_CREDENTIALS_PLACEHOLDER = `{
  "type": "service_account",
  "project_id": "your-firebase-project",
  "private_key_id": "…",
  "private_key": "-----BEGIN PRIVATE KEY-----\\n…\\n-----END PRIVATE KEY-----\\n",
  "client_email": "firebase-adminsdk@your-firebase-project.iam.gserviceaccount.com",
  "client_id": "…"
}`;

export const FIREBASE_CREDENTIALS_TOOLTIP = [
    'Must be a valid Google service account key JSON from Firebase/GCP.',
    'Must include client_email, private_key, and project_id.',
    'Use the institute’s own Firebase project (push notifications are sent via this project).',
    'You can alternatively paste a Base64-encoded JSON if preferred.',
];

export const FIREBASE_VALIDATION_MESSAGES = {
    required: 'This field is required to enable push notifications.',
    invalidJson: 'Please paste valid JSON.',
    missingFields: 'JSON must include client_email, private_key, and project_id.',
};

export function decodeBase64ToUtf8(base64: string): string {
    try {
        if (typeof atob === 'function') {
            // Browser
            return decodeURIComponent(
                Array.prototype.map
                    .call(atob(base64), function (c: string) {
                        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                    })
                    .join('')
            );
        }
    } catch (_) {
        // Fallback to Node path below
    }
    // Node/SSR safe fallback
    try {
        return Buffer.from(base64, 'base64').toString('utf-8');
    } catch (e) {
        throw new Error('Failed to decode Base64');
    }
}

export function tryParseJson<T = unknown>(
    input: string
): { ok: true; value: T } | { ok: false; error: Error } {
    try {
        return { ok: true, value: JSON.parse(input) as T };
    } catch (error) {
        return { ok: false, error: error as Error };
    }
}

export function normalizeServiceAccountInput(params: {
    jsonString?: string | null;
    base64String?: string | null;
}): string | null {
    const { jsonString, base64String } = params;
    if (base64String && base64String.trim().length > 0) {
        return decodeBase64ToUtf8(base64String.trim());
    }
    if (jsonString && jsonString.trim().length > 0) {
        return jsonString.trim();
    }
    return null;
}

export function validateFirebaseServiceAccountJson(jsonString: string): {
    valid: boolean;
    missingFields?: Array<keyof FirebaseServiceAccountMinimal>;
    parsed?: FirebaseServiceAccountMinimal & Record<string, unknown>;
    errorMessage?: string;
} {
    const parsedResult = tryParseJson<Record<string, unknown>>(jsonString);
    if (!parsedResult.ok) {
        return { valid: false, errorMessage: FIREBASE_VALIDATION_MESSAGES.invalidJson };
    }
    const obj = parsedResult.value as Record<string, unknown>;
    const required: Array<keyof FirebaseServiceAccountMinimal> = [
        'client_email',
        'private_key',
        'project_id',
    ];
    const missing = required.filter((key) => {
        const val = obj[key as string];
        return typeof val !== 'string' || (val as string).trim().length === 0;
    });
    if (missing.length > 0) {
        return {
            valid: false,
            missingFields: missing,
            errorMessage: FIREBASE_VALIDATION_MESSAGES.missingFields,
        };
    }
    return { valid: true, parsed: obj as FirebaseServiceAccountMinimal & Record<string, unknown> };
}

export function buildFirebaseSettingsUpdate(params: {
    enabled: boolean;
    jsonString?: string | null;
    base64String?: string | null;
}): { firebase: FirebaseSettings } {
    const normalized = normalizeServiceAccountInput({
        jsonString: params.jsonString ?? null,
        base64String: params.base64String ?? null,
    });
    return {
        firebase: {
            enabled: params.enabled,
            serviceAccountJson: normalized,
            serviceAccountJsonBase64: params.base64String ?? null,
        },
    };
}

export type NotificationSettingsUpsertRequest = {
    instituteId: string;
    settings: Omit<NotificationSettings, 'emails'>;
};

export async function getNotificationSettings(): Promise<NotificationSettingsResponse> {
    const instituteId = getInstituteId();
    const url = `${GET_NOTIFICATION_SETTINGS_BY_INSTITUTE}/${instituteId}`;
    const { data } = await axios.get(url);
    return data;
}

export async function getNotificationDefaultTemplate(): Promise<NotificationSettingsResponse> {
    const { data } = await axios.get(GET_NOTIFICATION_DEFAULT_TEMPLATE);
    return data;
}

export async function upsertNotificationSettings(
    request: NotificationSettingsUpsertRequest
): Promise<NotificationSettingsResponse> {
    const { data } = await axios.post(NOTIFICATION_SETTINGS_BASE, request, {
        headers: { 'Content-Type': 'application/json' },
    });
    return data;
}

export function createUpsertRequest(
    settings: Omit<NotificationSettings, 'emails'>
): NotificationSettingsUpsertRequest {
    return {
        instituteId: getInstituteId() ?? '',
        settings,
    };
}
