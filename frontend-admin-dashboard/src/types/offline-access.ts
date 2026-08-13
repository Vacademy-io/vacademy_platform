/**
 * Types mirroring admin_core_service's `learner_offline` feature package
 * (offline plan Part A1/A5/A6). All request/response JSON is snake_case
 * (`@JsonNaming(SnakeCaseStrategy)` on the DTOs) — mirror exactly.
 */

export type OfflineSourceType = 'PACKAGE' | 'PACKAGE_SESSION' | 'SUBJECT' | 'MODULE' | 'CHAPTER' | 'SLIDE';

/** Tri-state a node's offline rule can be edited to. `INHERIT` deletes the row (allow=null). */
export type OfflineTriState = 'INHERIT' | 'ALLOW' | 'BLOCK';

export interface OfflineRuleDTO {
    id: string;
    source_type: OfflineSourceType;
    source_id: string;
    package_session_id: string | null;
    allow: boolean | null;
}

export interface OfflineRuleUpsertDTO {
    source_type: OfflineSourceType;
    source_id: string;
    /** Omit for PACKAGE-level rules. */
    package_session_id?: string;
    /** null deletes the rule ("Inherit"). */
    allow: boolean | null;
}

export type OfflineDownloadReason = 'ALLOWED' | 'PERMISSION_DENIED' | 'ONLINE_ONLY';

export interface OfflineAssetRefDTO {
    file_id: string;
    role?: string;
    size_bytes?: number;
    checksum?: string;
    checksum_type?: string;
}

export interface OfflineManifestSlideDTO {
    slide_id: string;
    slide_type: string;
    title: string;
    slide_order?: number;
    downloadable: boolean;
    reason: OfflineDownloadReason;
    key_ref?: string | null;
    inline_payload?: unknown;
    assets?: OfflineAssetRefDTO[];
}

export interface OfflineManifestChapterDTO {
    chapter_id: string;
    chapter_name: string;
    chapter_order?: number;
    slides: OfflineManifestSlideDTO[];
}

export interface OfflineManifestModuleDTO {
    module_id: string;
    module_name: string;
    module_order?: number;
    chapters: OfflineManifestChapterDTO[];
}

export interface OfflineManifestSubjectDTO {
    subject_id: string;
    subject_name: string;
    subject_order?: number;
    modules: OfflineManifestModuleDTO[];
}

export interface OfflineManifestSettingsDTO {
    revalidation_days: number;
    max_devices: number;
}

export interface OfflineManifestDTO {
    package_session_id: string;
    manifest_version: number;
    settings: OfflineManifestSettingsDTO;
    subjects: OfflineManifestSubjectDTO[];
}

export interface OfflineAccessSettingsData {
    enabled: boolean;
    revalidationDays: number;
    maxDevices: number;
}

export const DEFAULT_OFFLINE_ACCESS_SETTINGS: OfflineAccessSettingsData = {
    enabled: false,
    revalidationDays: 7,
    maxDevices: 2,
};

export interface OfflineDownloadTelemetryDTO {
    learners_with_downloads: number;
    active_devices: number;
    per_slide_counts?: Record<string, number>;
}

/** One learner-device pair holding this batch offline (admin Downloads tab). */
export interface OfflineLearnerDownloadDTO {
    user_id: string;
    full_name?: string | null;
    username?: string | null;
    email?: string | null;
    /** offline_device.id — the id the revoke endpoint takes. */
    device_id: string;
    device_name?: string | null;
    platform?: string | null;
    device_status: 'ACTIVE' | 'REVOKED';
    last_checkin_at?: string | null;
    lease_expires_at?: string | null;
    downloaded_slides: number;
    first_downloaded_at?: string | null;
    last_downloaded_at?: string | null;
}

export interface OfflineSyncDiscrepancyDTO {
    id: string;
    client_event_id: string;
    activity_id?: string;
    user_id: string;
    slide_id?: string;
    package_session_id?: string;
    question_id?: string;
    field: string;
    client_value: string;
    server_value: string;
    status: 'OPEN' | 'REVIEWED';
    created_at: string;
}

export interface OfflineDeviceDTO {
    id: string;
    device_name: string;
    platform: string;
    status: 'ACTIVE' | 'REVOKED';
    client_device_id: string;
    lease_expires_at: string;
    last_checkin_at: string;
    registered_at: string;
    revoked_at?: string;
    revoke_reason?: string;
}

/** A subtree scan result feeding the §7.4 "N items cannot be downloaded" warning. */
export interface OfflineSubtreeWarning {
    totalSlides: number;
    onlineOnlyCount: number;
}
