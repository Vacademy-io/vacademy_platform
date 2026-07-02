package vacademy.io.admin_core_service.features.suborg.registration.enums;

/**
 * Status machine for one open self-registration attempt:
 * DRAFT (details submitted, OTP sent) -> OTP_VERIFIED -> COMPLETED (sub-org spawned).
 * FAILED is a terminal parking state for attempts abandoned after a spawn error.
 */
public enum SubOrgRegistrationStatus {
    DRAFT,
    OTP_VERIFIED,
    COMPLETED,
    FAILED
}
