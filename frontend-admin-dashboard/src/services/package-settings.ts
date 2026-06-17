import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getInstituteId } from '@/constants/helper';
import {
    INSTITUTE_SETTING_SAVE_LOCAL,
    LMS_APPLY_CONNECTION_TO_PACKAGE,
    LMS_PACKAGE_ATTACHED_WORKFLOW,
    LMS_PACKAGE_WORKFLOW_TRIGGERS,
    LMS_PROVIDERS,
    LMS_TEST_CONNECTION,
    PACKAGE_SETTING_ALL,
    PACKAGE_SETTING_APPLY_INSTITUTE_LMS,
    PACKAGE_SETTING_DATA,
    PACKAGE_SETTING_RAW,
    PACKAGE_SETTING_SAVE,
    WORKFLOWS_BY_INSTITUTE,
    WORKFLOW_TRIGGER_EVENTS,
} from '@/constants/urls';

/**
 * Per-course (package-level) settings live in the `package.course_setting` JSON
 * column as an open-ended envelope: `{ "setting": { "<KEY>": { key, name, data } } }`.
 * Workflows read arbitrary keys out of it, so the primary surface is raw-JSON
 * editing; typed helpers cover the LMS keys.
 */

export interface PackageSettingEnvelope {
    setting?: Record<string, { key?: string; name?: string; data?: unknown }>;
    [k: string]: unknown;
}

/** One connection field in a provider's setup form (backend-driven, so the UI stays non-technical). */
export interface LmsProviderField {
    key: string;
    label: string;
    help?: string;
    placeholder?: string;
    /** url | text | secret */
    type: 'url' | 'text' | 'secret';
    required: boolean;
}

/** A selectable LMS with everything the UI needs to render a friendly card + guided form. */
export interface LmsProviderMeta {
    id: string;
    displayName: string;
    tagline?: string;
    description?: string;
    enables?: string[];
    docsUrl?: string;
    requiresConnection: boolean;
    fields: LmsProviderField[];
}

/** One saved LMS connection in the institute's library. `type` is LEARNDASH | MOODLE; the
 *  remaining keys are that type's connection fields (apiUrl, moodleToken, …). */
export interface LmsConnection {
    id: string;
    type: string;
    name: string;
    [field: string]: string;
}

export interface LmsProvidersResponse {
    availableLms: string[];
    activeLms: string;
    /** LMS_SETTING.data.data — holds activeLms + the active provider's connection fields. */
    instituteLmsConfig: Record<string, unknown> | null;
    /** Rich catalog (display names, help, field schema) for the cards + guided form. */
    providers?: LmsProviderMeta[];
    /** The institute's saved LMS connections (multiple supported). */
    connections?: LmsConnection[];
    /** Which connection is the institute default (mirrored to activeLms for legacy readers). */
    defaultConnectionId?: string | null;
    /** Where instituteLmsConfig came from: INSTITUTE | COURSE | NONE. "COURSE" means we
     *  surfaced a connection the admin already set up on a course. */
    configSource?: 'INSTITUTE' | 'COURSE' | 'NONE';
}

export interface InstituteWorkflowOption {
    id: string;
    name: string;
}

/** Institute workflows for the "attach workflow" picker. Maps loosely over the list shape. */
export const fetchInstituteWorkflows = async (): Promise<InstituteWorkflowOption[]> => {
    const instituteId = getInstituteId();
    if (!instituteId) return [];
    try {
        const { data } = await authenticatedAxiosInstance.get(
            `${WORKFLOWS_BY_INSTITUTE}/${instituteId}`
        );
        const list = Array.isArray(data) ? data : ((data?.content ?? []) as unknown[]);
        return (list as Array<Record<string, unknown>>)
            .map((w) => ({
                id: String(w.id ?? w.workflowId ?? ''),
                name: String(w.name ?? w.workflowName ?? w.id ?? 'Untitled workflow'),
            }))
            .filter((w) => w.id);
    } catch {
        return [];
    }
};

/** ALL enrolment workflows already attached to a course (via its package sessions' triggers). */
export const fetchPackageAttachedWorkflows = async (
    packageId: string
): Promise<InstituteWorkflowOption[]> => {
    try {
        const { data } = await authenticatedAxiosInstance.get(LMS_PACKAGE_ATTACHED_WORKFLOW, {
            params: { packageId },
        });
        const list = Array.isArray(data?.attachedWorkflows) ? data.attachedWorkflows : [];
        return (list as Array<Record<string, unknown>>)
            .map((w) => ({ id: String(w.id ?? ''), name: String(w.name ?? w.id ?? '') }))
            .filter((w) => w.id);
    } catch {
        return [];
    }
};

/** A trigger event from the workflow catalog (for the course trigger-event picker). */
export interface TriggerEventOption {
    key: string;
    label: string;
    eventAppliedType: string | null;
}

/** One workflow trigger attached to a course: a workflow that fires on a trigger event. */
export interface PackageWorkflowTrigger {
    triggerEventName: string;
    workflowId: string;
    workflowName?: string;
}

/** All trigger events (key + label + applied type) the platform supports. */
export const fetchTriggerEvents = async (): Promise<TriggerEventOption[]> => {
    try {
        const { data } = await authenticatedAxiosInstance.get(WORKFLOW_TRIGGER_EVENTS);
        const list = Array.isArray(data) ? data : [];
        return (list as Array<Record<string, unknown>>)
            .map((e) => ({
                key: String(e.key ?? ''),
                label: String(e.label ?? e.key ?? ''),
                eventAppliedType: (e.eventAppliedType ?? e.event_applied_type ?? null) as
                    | string
                    | null,
            }))
            .filter((e) => e.key);
    } catch {
        return [];
    }
};

/** The workflow triggers (any event) currently attached to a course. */
export const fetchPackageWorkflowTriggers = async (
    packageId: string
): Promise<PackageWorkflowTrigger[]> => {
    try {
        const { data } = await authenticatedAxiosInstance.get(LMS_PACKAGE_WORKFLOW_TRIGGERS, {
            params: { packageId },
        });
        const list = Array.isArray(data) ? data : [];
        return (list as Array<Record<string, unknown>>)
            .map((t) => ({
                triggerEventName: String(t.triggerEventName ?? ''),
                workflowId: String(t.workflowId ?? ''),
                workflowName: t.workflowName ? String(t.workflowName) : undefined,
            }))
            .filter((t) => t.triggerEventName && t.workflowId);
    } catch {
        return [];
    }
};

/** Save (authoritative) the course's workflow triggers — attach the listed pairs, detach the rest. */
export const savePackageWorkflowTriggers = async (
    packageId: string,
    triggers: Array<{ triggerEventName: string; workflowId: string }>
): Promise<{ created: number; removed: number }> => {
    const instituteId = getInstituteId();
    const { data } = await authenticatedAxiosInstance.post(
        LMS_PACKAGE_WORKFLOW_TRIGGERS,
        triggers,
        {
            params: { instituteId, packageId },
        }
    );
    return { created: data?.created ?? 0, removed: data?.removed ?? 0 };
};

/** Use an institute LMS connection for a course: writes the per-course key + (optionally) attaches a workflow. */
export const applyLmsConnectionToPackage = async (
    packageId: string,
    body: {
        connectionId: string;
        courseId?: string;
        /** Full set of enrolment workflows to attach (authoritative; absent ones are detached). */
        workflowIds?: string[];
        /** Extra key–value pairs merged into the course's LMS setting JSON. */
        extraFields?: Record<string, string>;
    }
): Promise<{ applied: boolean; connectionType?: string; workflowTriggersCreated?: number }> => {
    const instituteId = getInstituteId();
    const { data } = await authenticatedAxiosInstance.post(LMS_APPLY_CONNECTION_TO_PACKAGE, body, {
        params: { instituteId, packageId },
    });
    return data;
};

export interface LmsConnectionTestResult {
    ok: boolean;
    provider: string;
    message: string;
    detail?: string;
}

/** Live-test an LMS connection from the current form values (before saving). */
export const testLmsConnection = async (
    activeLms: string,
    fields: Record<string, string>
): Promise<LmsConnectionTestResult> => {
    const response = await authenticatedAxiosInstance.post<LmsConnectionTestResult>(
        LMS_TEST_CONNECTION,
        { activeLms, fields }
    );
    return response.data;
};

export const EMPTY_COURSE_SETTING = '{\n  "setting": {}\n}';

/** Raw course_setting JSON string for a package (defaults to an empty envelope). */
export const getPackageCourseSettingRaw = async (packageId: string): Promise<string> => {
    const response = await authenticatedAxiosInstance.get<string>(PACKAGE_SETTING_RAW, {
        params: { packageId },
        // Keep the server string verbatim — don't let axios JSON-parse it.
        transformResponse: [(d) => d],
    });
    return typeof response.data === 'string' && response.data.length
        ? response.data
        : EMPTY_COURSE_SETTING;
};

/** Whole parsed envelope. */
export const getPackageSettingAll = async (packageId: string): Promise<PackageSettingEnvelope> => {
    const response = await authenticatedAxiosInstance.get<PackageSettingEnvelope>(
        PACKAGE_SETTING_ALL,
        {
            params: { packageId },
        }
    );
    return response.data ?? { setting: {} };
};

/** Only the `data` part of a single setting key (null if absent). */
export const getPackageSettingData = async (
    packageId: string,
    settingKey: string
): Promise<unknown> => {
    const response = await authenticatedAxiosInstance.get(PACKAGE_SETTING_DATA, {
        params: { packageId, settingKey },
    });
    return response.data ?? null;
};

/**
 * Replace the whole course_setting JSON. The body must be a valid JSON object
 * wrapped in a `{ "setting": { ... } }` envelope (validated server-side too).
 */
export const savePackageCourseSettingRaw = async (
    packageId: string,
    rawJson: string
): Promise<string> => {
    const response = await authenticatedAxiosInstance.post<string>(PACKAGE_SETTING_RAW, rawJson, {
        params: { packageId },
        headers: { 'Content-Type': 'text/plain' },
    });
    return response.data;
};

/** Upsert a single setting key, preserving the other keys. */
export const savePackageSettingKey = async (
    packageId: string,
    settingKey: string,
    settingData: unknown,
    settingName?: string
): Promise<string> => {
    const response = await authenticatedAxiosInstance.post<string>(
        PACKAGE_SETTING_SAVE,
        { setting_name: settingName ?? settingKey.replace(/_/g, ' '), setting_data: settingData },
        { params: { packageId, settingKey }, headers: { 'Content-Type': 'application/json' } }
    );
    return response.data;
};

/** Copy the institute's LMS config into this package's LMS keys. */
export const applyInstituteLmsToPackage = async (packageId: string): Promise<string> => {
    const instituteId = getInstituteId();
    const response = await authenticatedAxiosInstance.post<string>(
        PACKAGE_SETTING_APPLY_INSTITUTE_LMS,
        null,
        { params: { instituteId, packageId } }
    );
    return response.data;
};

/** Connected LMS providers + the institute's active LMS + raw institute LMS config. */
export const getLmsProviders = async (): Promise<LmsProvidersResponse> => {
    const instituteId = getInstituteId();
    const response = await authenticatedAxiosInstance.get<LmsProvidersResponse>(LMS_PROVIDERS, {
        params: { instituteId },
    });
    return response.data;
};

/**
 * Save an institute setting key with the double-`data` shape consumers expect
 * (`setting.<KEY>.data.data.<field>`). LMS config is split across keys:
 *   - LMS_SETTING.data.data  → { activeLms, ...LearnDash fields }
 *   - MOODLE_SETTING.data.data → { moodleToken, moodleBaseUrl, ... }
 */
export const saveInstituteSettingKey = async (
    settingKey: string,
    dataData: Record<string, unknown>,
    settingName?: string
): Promise<void> => {
    const instituteId = getInstituteId();
    if (!instituteId) throw new Error('Institute ID not found. Please log in again.');
    await authenticatedAxiosInstance.post(
        INSTITUTE_SETTING_SAVE_LOCAL,
        {
            setting_name: settingName ?? settingKey.replace(/_/g, ' '),
            setting_data: { data: dataData },
        },
        { params: { instituteId, settingKey }, headers: { 'Content-Type': 'application/json' } }
    );
};

/** Validate + pretty-print a course_setting JSON string. Throws on invalid JSON. */
export const validateCourseSettingJson = (raw: string): string => {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Top-level value must be a JSON object');
    }
    if (
        typeof parsed.setting !== 'object' ||
        parsed.setting === null ||
        Array.isArray(parsed.setting)
    ) {
        throw new Error('JSON must contain a "setting" object, e.g. { "setting": { ... } }');
    }
    return JSON.stringify(parsed, null, 2);
};
