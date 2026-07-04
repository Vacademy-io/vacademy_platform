package vacademy.io.admin_core_service.features.suborg.registration.enums;

/**
 * Status machine for one open self-registration attempt:
 * DRAFT (details submitted, OTP sent) -> OTP_VERIFIED -> COMPLETED (sub-org spawned).
 * FAILED is a terminal parking state for attempts abandoned after a spawn error.
 */
public enum SubOrgRegistrationStatus {
    DRAFT,
    OTP_VERIFIED,
    // Paid templates: sub-org spawned + UserPlan PENDING_FOR_PAYMENT; flipped to COMPLETED
    // by the payment webhook (UserPlanService.applyOperationsOnFirstPayment SUB_ORG branch).
    PENDING_PAYMENT,
    COMPLETED,
    FAILED
}
