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
    chat?: ChatSettings;
    emails?: Array<{
        id: string;
        email: string;
        type: string;
    }>;
    firebase?: FirebaseSettings;
};

// Chat settings block, persisted under institute-settings `settings.chat`.
// Inner keys are snake_case to match the backend JSON shape EXACTLY.
export type ChatModerationAction = 'BLOCK' | 'FLAG';

export type ChatDirectRole = 'student' | 'teacher' | 'admin';

export type ChatDirectMatrix = Record<ChatDirectRole, Record<ChatDirectRole, boolean>>;

export type ChatSettings = {
    enabled: boolean;
    batch_group: {
        students_can_post: boolean;
        teachers_can_post: boolean;
    };
    community: {
        students_can_post: boolean;
        teachers_can_post: boolean;
        admins_can_post: boolean;
        rules: {
            guidelines: {
                title: string;
                items: string[];
            };
            acknowledgement_required: boolean;
            posting: {
                slow_mode_seconds: number;
                allow_links: boolean;
                allow_attachments: boolean;
                new_member_readonly_minutes: number;
            };
            auto_moderation: {
                banned_keywords: string[];
                action: ChatModerationAction;
            };
        };
    };
    direct: {
        enabled: boolean;
        matrix: ChatDirectMatrix;
    };
    attachments: {
        images_enabled: boolean;
        files_enabled: boolean;
        max_file_size_mb: number;
    };
};

// Defaults used when settings.chat is missing. Chat is OFF by default — an admin opts in here; the
// per-channel posting defaults stay open so once enabled it "just works".
export function getDefaultChatSettings(): ChatSettings {
    return {
        enabled: false,
        batch_group: {
            students_can_post: true,
            teachers_can_post: true,
        },
        community: {
            students_can_post: true,
            teachers_can_post: true,
            admins_can_post: true,
            rules: {
                guidelines: {
                    title: 'Community Guidelines',
                    items: [],
                },
                acknowledgement_required: false,
                posting: {
                    slow_mode_seconds: 0,
                    allow_links: true,
                    allow_attachments: true,
                    new_member_readonly_minutes: 0,
                },
                auto_moderation: {
                    banned_keywords: [],
                    action: 'FLAG',
                },
            },
        },
        direct: {
            enabled: true,
            matrix: {
                student: { student: true, teacher: true, admin: true },
                teacher: { student: true, teacher: true, admin: true },
                admin: { student: true, teacher: true, admin: true },
            },
        },
        attachments: {
            images_enabled: true,
            files_enabled: true,
            max_file_size_mb: 25,
        },
    };
}

type DeepPartial<T> = T extends Array<unknown>
    ? T
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> }
      : T;

// Deep-merge a possibly-partial chat settings object against the full defaults so
// every nested object / array / matrix is guaranteed present. A persisted
// settings.chat that omits sub-objects (e.g. no `direct`, no `community.rules`)
// would otherwise crash the Notification tab when the UI indexes into them.
export function mergeChatSettings(partial?: DeepPartial<ChatSettings> | null): ChatSettings {
    const d = getDefaultChatSettings();
    const p = partial ?? {};
    const pCommunity = p.community ?? {};
    const pRules = pCommunity.rules ?? {};
    const pMatrix = p.direct?.matrix ?? {};
    const mergeMatrixRow = (role: ChatDirectRole): Record<ChatDirectRole, boolean> => ({
        ...d.direct.matrix[role],
        ...(pMatrix[role] ?? {}),
    });
    return {
        enabled: p.enabled ?? d.enabled,
        batch_group: {
            ...d.batch_group,
            ...(p.batch_group ?? {}),
        },
        community: {
            students_can_post: pCommunity.students_can_post ?? d.community.students_can_post,
            teachers_can_post: pCommunity.teachers_can_post ?? d.community.teachers_can_post,
            admins_can_post: pCommunity.admins_can_post ?? d.community.admins_can_post,
            rules: {
                guidelines: {
                    title: pRules.guidelines?.title ?? d.community.rules.guidelines.title,
                    items: pRules.guidelines?.items ?? d.community.rules.guidelines.items,
                },
                acknowledgement_required:
                    pRules.acknowledgement_required ??
                    d.community.rules.acknowledgement_required,
                posting: {
                    ...d.community.rules.posting,
                    ...(pRules.posting ?? {}),
                },
                auto_moderation: {
                    banned_keywords:
                        pRules.auto_moderation?.banned_keywords ??
                        d.community.rules.auto_moderation.banned_keywords,
                    action:
                        pRules.auto_moderation?.action ??
                        d.community.rules.auto_moderation.action,
                },
            },
        },
        direct: {
            enabled: p.direct?.enabled ?? d.direct.enabled,
            matrix: {
                student: mergeMatrixRow('student'),
                teacher: mergeMatrixRow('teacher'),
                admin: mergeMatrixRow('admin'),
            },
        },
        attachments: {
            ...d.attachments,
            ...(p.attachments ?? {}),
        },
    };
}

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
