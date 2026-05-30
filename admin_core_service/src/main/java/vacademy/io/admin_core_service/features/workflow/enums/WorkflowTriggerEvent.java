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
    AUDIENCE_OPT_OUT,

    // Existing - Fee
    INSTALLMENT_DUE_REMINDER,

    // Live Session
    LIVE_SESSION_CREATE,
    LIVE_SESSION_START,
    LIVE_SESSION_END,
    LIVE_SESSION_FORM_SUBMISSION,

    // Payment
    PAYMENT_FAILED,
    PAYMENT_SUCCESS,
    ABANDONED_CART,

    // Subscription / plan lifecycle
    SUBSCRIPTION_CANCELLED,
    SUBSCRIPTION_TERMINATED,
    LEARNER_RE_ENROLLMENT,

    // Fired when an admin makes a learner INACTIVE in a package session
    // (institute_learner MAKE_INACTIVE operation). Keyed by eventId = packageSessionId.
    LEARNER_TERMINATION,

    // LMS / content / engagement
    COURSE_CREATED,
    DOUBT_RAISED,
    ASSIGNMENT_SUBMITTED,

    // Invites
    INVITE_CREATE,
    INVITE_FORM_FILL,

    // CRM
    MEMBERSHIP_EXPIRY,
    ENROLLMENT_REPORTS,

    // Lead TAT / Follow-up SLA (emit-only; delivery handled by the workflow engine)
    LEAD_ASSIGNED_TO_COUNSELOR,
    LEAD_TAT_REMINDER_BEFORE,
    LEAD_TAT_OVERDUE,
    FOLLOW_UP_DUE,
    FOLLOW_UP_OVERDUE,
    LEAD_STATUS_CHANGED,

    // Assessment (cross-service via internal HTTP)
    ASSESSMENT_CREATE,
    ASSESSMENT_START,
    ASSESSMENT_END,
    ASSESSMENT_FORM_SUBMISSION
}

