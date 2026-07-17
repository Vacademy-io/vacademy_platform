package vacademy.io.admin_core_service.features.workflow.enums;

public enum EventAppliedType {
    PACKAGE_SESSION,
    AUDIENCE,
    LIVE_SESSION,
    ENROLL_INVITE,
    PAYMENT,
    USER_PLAN,
    INSTITUTE,
    ASSESSMENT,
    // Counselor-pool scope: eventId holds the pool's id. A trigger of this type fires for
    // any lead whose audience belongs to that pool, in addition to institute-level triggers.
    POOL,
    // Metadata only (matching is still by eventId/eventName) -- eventId holds an
    // onboarding_step.id, used by admins to identify onboarding-step triggers in the UI.
    ONBOARDING_STEP
}
