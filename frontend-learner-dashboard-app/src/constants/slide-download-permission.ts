/**
 * Per-role, per-slide-type download-permission setting — learner-app copy.
 *
 * Mirrors the admin app's `@/constants/slide-download-permission`. The admin
 * Settings tab writes this blob (stored under
 * `institutes.setting_json → setting.SLIDE_DOWNLOAD_PERMISSION_SETTING.data`);
 * the learner app reads it to decide whether to render each slide's download
 * control. Enforcement is best-effort, client-side — it hides our own controls,
 * it does NOT prevent fetching a public/signed file URL.
 */

export const SLIDE_DOWNLOAD_PERMISSION_SETTING_KEY = "SLIDE_DOWNLOAD_PERMISSION_SETTING";

export const ADMIN_ROLE_KEY = "ADMIN";
export const TEACHER_ROLE_KEY = "TEACHER";
export const LEARNER_ROLE_KEY = "LEARNER";

// The platform's learner role is emitted as "STUDENT" in access tokens but is
// stored/presented as "LEARNER".
const ROLE_ALIASES: Record<string, string> = {
  STUDENT: LEARNER_ROLE_KEY,
};

export const normalizeRoleKey = (role: string | null | undefined): string => {
  const upper = (role ?? "").toUpperCase().trim();
  return ROLE_ALIASES[upper] ?? upper;
};

/** Slide-type keys the learner components pass into the resolver. */
export const SlideDownloadTypeKey = {
  DOCUMENT_PDF: "DOCUMENT_PDF",
  DOCUMENT_DOC: "DOCUMENT_DOC",
  DOCUMENT_PRESENTATION: "DOCUMENT_PRESENTATION",
  DOCUMENT_CODE: "DOCUMENT_CODE",
  DOCUMENT_JUPYTER: "DOCUMENT_JUPYTER",
  DOCUMENT_SCRATCH: "DOCUMENT_SCRATCH",
  VIDEO: "VIDEO",
  AUDIO: "AUDIO",
  ASSIGNMENT: "ASSIGNMENT",
  QUESTION: "QUESTION",
} as const;

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

// Mirrors what a learner / other consuming role can download in the learner app
// today, so an absent setting keeps current behavior (e.g. the PDF toolbar
// already hides Download → false).
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

/**
 * Decide whether the current user may download a given slide type.
 * Permissive union across held roles; unconfigured cells use the role-aware
 * default. With no roles, falls back to the learner default.
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
