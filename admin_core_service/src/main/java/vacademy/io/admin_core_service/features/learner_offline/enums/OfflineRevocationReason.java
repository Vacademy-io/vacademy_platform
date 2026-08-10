package vacademy.io.admin_core_service.features.learner_offline.enums;

/**
 * Why offline content for a package session must be purged from a device, as
 * returned per-course in the check-in response (offline plan, Part A3). Also
 * reused as the freeform-but-conventional value stored in
 * {@code offline_device.revoke_reason} when a device itself is revoked
 * (self or admin) -- DEVICE_REVOKED is the default there.
 */
public enum OfflineRevocationReason {
    DEVICE_REVOKED,
    UNENROLLED,
    OFFLINE_DISABLED
}
