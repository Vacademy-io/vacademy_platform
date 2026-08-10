package vacademy.io.admin_core_service.features.learner_offline.enums;

/**
 * Lifecycle state of an {@code offline_device} row (offline plan, Part A3).
 * REVOKED devices fail check-in with {@code deviceStatus:"REVOKED"} and every
 * installed course comes back as a PURGE revocation — see OfflineCheckInService.
 */
public enum OfflineDeviceStatus {
    ACTIVE,
    REVOKED
}
