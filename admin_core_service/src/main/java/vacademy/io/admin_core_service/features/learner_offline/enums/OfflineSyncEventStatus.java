package vacademy.io.admin_core_service.features.learner_offline.enums;

/**
 * Per-event outcome returned to the client for a batch (offline plan, Part
 * A4). Only ACCEPTED and FAILED are ever persisted on offline_sync_event --
 * DUPLICATE is derived at read time (an ACCEPTED row already existed for the
 * clientEventId) and never written to the status column.
 */
public enum OfflineSyncEventStatus {
    ACCEPTED,
    DUPLICATE,
    FAILED
}
