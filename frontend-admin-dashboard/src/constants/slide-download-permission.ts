/**
 * Shared types, keys, defaults and resolver for the per-role, per-slide-type
 * download-permission setting (stored under
 * `institutes.setting_json → setting.SLIDE_DOWNLOAD_PERMISSION_SETTING.data`).
 *
 * Used by the admin Settings tab (to configure). The learner app keeps an
 * equivalent copy and is where the setting is enforced (it is the
 * content-consumption surface the admin is configuring "for the learner and
 * other roles' ends"). The admin authoring tool's own download buttons are
 * intentionally NOT gated by this setting.
 *
 * Enforcement is best-effort, client-side: it hides our own download controls.
 * It does NOT prevent a determined user from fetching a public/signed file URL.
 */

export const SLIDE_DOWNLOAD_PERMISSION_SETTING_KEY = 'SLIDE_DOWNLOAD_PERMISSION_SETTING';

/** Canonical role keys used as stored map keys / grid columns. */
export const ADMIN_ROLE_KEY = 'ADMIN';
export const TEACHER_ROLE_KEY = 'TEACHER';
export const LEARNER_ROLE_KEY = 'LEARNER';

/**
 * Token role-name aliases → canonical key. The platform's learner role is
 * emitted as "STUDENT" in access tokens, but we present/store it as "LEARNER".
 */
const ROLE_ALIASES: Record<string, string> = {
    STUDENT: LEARNER_ROLE_KEY,
};

/** Normalize a raw role name (token or custom) to its canonical stored key. */
export const normalizeRoleKey = (role: string | null | undefined): string => {
    const upper = (role ?? '').toUpperCase().trim();
    return ROLE_ALIASES[upper] ?? upper;
};

export interface SlideTypeOption {
    /** Stored key (also the enforcement key the slide components pass in). */
    key: string;
    /** Human label shown as the grid row header. */
    label: string;
}

/**
 * The slide types exposed as rows — limited to those that have a real,
 * client-side-controllable download in the learner app (our own button or an
 * HTML5 control we render). Other types either render read-only (plain
 * documents, presentations), only "open" externally (Jupyter/Scratch), or have
 * no download control at all (audio), so a toggle would be a no-op. DOCUMENT is
 * split into sub-types because each has a different download mechanism.
 */
export const SLIDE_TYPE_OPTIONS: SlideTypeOption[] = [
    { key: 'DOCUMENT_PDF', label: 'PDF' },
    { key: 'DOCUMENT_CODE', label: 'Code' },
    { key: 'ASSIGNMENT', label: 'Assignment' },
    { key: 'VIDEO', label: 'Video' },
];

/**
 * Default download ability when the setting is absent / a cell is unconfigured.
 * Defaults are chosen to preserve today's behavior so existing institutes are
 * unchanged, and are role-aware because the same role's current behavior
 * differs between the authoring app and the learner app:
 *
 *  - ADMIN_DEFAULT_DOWNLOAD mirrors what an admin can download today.
 *  - LEARNER_DEFAULT_DOWNLOAD mirrors what a learner / other consuming role can
 *    download in the learner app today (e.g. the PDF toolbar already hides
 *    Download, so PDF defaults to false there).
 */
export const ADMIN_DEFAULT_DOWNLOAD: Record<string, boolean> = {
    DOCUMENT_PDF: true,
    DOCUMENT_DOC: true,
    DOCUMENT_PRESENTATION: true,
    DOCUMENT_CODE: true,
    DOCUMENT_JUPYTER: true,
    DOCUMENT_SCRATCH: true,
    VIDEO: false,
    AUDIO: false,
    ASSIGNMENT: true,
    QUESTION: true,
};

export const LEARNER_DEFAULT_DOWNLOAD: Record<string, boolean> = {
    DOCUMENT_PDF: false,
    DOCUMENT_DOC: false,
    DOCUMENT_PRESENTATION: false,
    DOCUMENT_CODE: true,
    DOCUMENT_JUPYTER: false,
    DOCUMENT_SCRATCH: false,
    VIDEO: false,
    AUDIO: false,
    ASSIGNMENT: true,
    QUESTION: true,
};

/** Default download ability for a (role, slide-type) when unconfigured. */
export const defaultDownloadFor = (roleKey: string, typeKey: string): boolean => {
    if (normalizeRoleKey(roleKey) === ADMIN_ROLE_KEY) {
        return ADMIN_DEFAULT_DOWNLOAD[typeKey] ?? true;
    }
    return LEARNER_DEFAULT_DOWNLOAD[typeKey] ?? true;
};

export interface SlideDownloadRoleMap {
    [roleKey: string]: boolean;
}

export interface SlideDownloadSlideTypeConfig {
    roles: SlideDownloadRoleMap;
}

export interface SlideDownloadPermissionData {
    version: number;
    slideTypes: Record<string, SlideDownloadSlideTypeConfig>;
}

export const EMPTY_SLIDE_DOWNLOAD_DATA: SlideDownloadPermissionData = {
    version: 1,
    slideTypes: {},
};

/**
 * Decide whether the current user may download a given slide type.
 *
 * Permissive union across the roles the user holds: download is allowed if ANY
 * held role allows it. A role's effective flag is its stored value, or the
 * role-aware default when unconfigured. With no roles, falls back to the
 * learner default (i.e. today's learner behavior).
 *
 * @param data       parsed setting data (or null when unset)
 * @param typeKey    one of SLIDE_TYPE_OPTIONS[].key
 * @param roleNames  the user's raw role names (e.g. ["STUDENT"]); normalized here
 */
export const canDownloadSlideType = (
    data: SlideDownloadPermissionData | null | undefined,
    typeKey: string,
    roleNames: string[] | null | undefined
): boolean => {
    const canonicalRoles = (roleNames ?? []).map(normalizeRoleKey).filter(Boolean);
    if (canonicalRoles.length === 0) {
        return LEARNER_DEFAULT_DOWNLOAD[typeKey] ?? true;
    }
    const roleMap = data?.slideTypes?.[typeKey]?.roles;
    return canonicalRoles.some(
        (role) => roleMap?.[role] ?? defaultDownloadFor(role, typeKey)
    );
};
