/** Row types for the offline DB (plan §B2). Mirrors schema.sql exactly. */

/** COURSE is the whole package session — its node_id IS the package_session_id. */
export type OfflineNodeType = "COURSE" | "SUBJECT" | "MODULE" | "CHAPTER" | "SLIDE";

export type NodeDownloadStatus =
    | "NOT_DOWNLOADED"
    | "QUEUED"
    | "DOWNLOADING"
    | "DOWNLOADED"
    | "PARTIAL"
    | "UPDATE_AVAILABLE"
    | "REMOVED_BY_ADMIN"
    | "ERROR";

export type AssetDownloadStatus = "PENDING" | "DOWNLOADING" | "DOWNLOADED" | "FAILED";

export type EventSyncStatus = "PENDING" | "IN_FLIGHT" | "SYNCED" | "FAILED_PERMANENT";

export interface DeviceStateRow {
    user_id: string;
    device_id: string | null;
    device_registration_id: string | null;
    lease_expires_at: number | null;
    last_checkin_at: number | null;
    last_checkin_monotonic: number | null;
    revoked: number;
}

export interface ManifestRow {
    user_id: string;
    package_session_id: string;
    institute_id: string | null;
    version: number;
    fetched_at: number;
    tree_json: string;
    update_available: number;
}

export interface NodeRow {
    user_id: string;
    node_id: string;
    node_type: OfflineNodeType;
    package_session_id: string;
    parent_id: string | null;
    status: NodeDownloadStatus;
    bytes_total: number;
    bytes_done: number;
}

export interface AssetRow {
    user_id: string;
    file_id: string;
    slide_id: string;
    package_session_id: string;
    size: number;
    checksum: string | null;
    nonce: string | null;
    local_path: string | null;
    status: AssetDownloadStatus;
    bytes_downloaded: number;
    attempt_count: number;
}

export interface SlidePayloadRow {
    user_id: string;
    slide_id: string;
    manifest_version: number;
    ciphertext: string;
    nonce: string;
    key_ref: string | null;
}

/** Batch 2 (plan §B9/§5): "Removed by your institute" / update / lease notices for the downloads screen. */
export type OfflineNoticeKind =
    | "UNENROLLED"
    | "OFFLINE_DISABLED"
    | "DEVICE_REVOKED"
    | "LEASE_EXPIRED"
    | "UPDATE_AVAILABLE"
    /** Offline work the server kept rejecting until it ran out of retries. */
    | "SYNC_FAILED";

export interface NoticeRow {
    id: string;
    user_id: string;
    kind: OfflineNoticeKind;
    package_session_id: string | null;
    message: string | null;
    created_at: number;
    seen: number;
}

export interface EventQueueRow {
    client_event_id: string;
    user_id: string;
    seq: number;
    client_ts: number;
    event_type: string;
    /** JSON string: {slideId, chapterId, moduleId, subjectId, packageSessionId} */
    context: string | null;
    /** JSON string: ActivityLogDTO-shaped payload */
    payload: string;
    sync_status: EventSyncStatus;
    attempt_count: number;
    last_error: string | null;
}
