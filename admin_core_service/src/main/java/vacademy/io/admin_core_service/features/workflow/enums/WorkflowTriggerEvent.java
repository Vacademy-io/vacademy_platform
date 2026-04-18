package vacademy.io.admin_core_service.features.workflow.enums;

public enum WorkflowTriggerEvent {
    // Existing - Enrollment
    LEARNER_BATCH_ENROLLMENT,
    GENERATE_ADMIN_LOGIN_URL_FOR_LEARNER_PORTAL,
    SEND_LEARNER_CREDENTIALS,
    SUB_ORG_MEMBER_ENROLLMENT,
    SUB_ORG_MEMBER_TERMINATION,

    // Existing - Audience / CRM
    AUDIENCE_LEAD_SUBMISSION,

    // Existing - Fee
    INSTALLMENT_DUE_REMINDER,

    // Live Session
    LIVE_SESSION_CREATE,
    LIVE_SESSION_START,
    LIVE_SESSION_END,
    LIVE_SESSION_FORM_SUBMISSION,

    // Payment
    PAYMENT_FAILED,
    ABANDONED_CART,

    // Invites
    INVITE_CREATE,
    INVITE_FORM_FILL,

    // CRM
    MEMBERSHIP_EXPIRY,
    ENROLLMENT_REPORTS,

    // Assessment (cross-service via internal HTTP)
    ASSESSMENT_CREATE,
    ASSESSMENT_START,
    ASSESSMENT_END,
    ASSESSMENT_FORM_SUBMISSION
}

