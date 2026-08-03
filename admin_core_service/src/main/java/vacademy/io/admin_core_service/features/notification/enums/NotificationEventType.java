package vacademy.io.admin_core_service.features.notification.enums;

public enum NotificationEventType {
    LEARNER_ENROLL("LEARNER_ENROLL"),
    PAYMENT_SUCCESS("PAYMENT_SUCCESS"),
    PAYMENT_FAILED("PAYMENT_FAILED"),
    COURSE_COMPLETED("COURSE_COMPLETED"),
    COURSE_STARTED("COURSE_STARTED"),
    ASSIGNMENT_DUE("ASSIGNMENT_DUE"),
    LIVE_SESSION_REMINDER("LIVE_SESSION_REMINDER"),
    CERTIFICATE_GENERATED("CERTIFICATE_GENERATED"),
    REFERRAL_INVITATION("REFERRAL_INVITATION"),
    AUDIENCE_FORM_SUBMISSION("AUDIENCE_FORM_SUBMISSION"),
    OTP_REQUEST("OTP_REQUEST"),
    APPLICATION_PAYMENT_PENDING("APPLICATION_PAYMENT_PENDING"),
    APPLICATION_FORM_SUBMISSION("APPLICATION_FORM_SUBMISSION"),
    ADMISSION_FORM_SUBMISSION("ADMISSION_FORM_SUBMISSION"),
    ENQUIRY_FORM_SUBMISSION("ENQUIRY_FORM_SUBMISSION"),
    LIVE_CLASS_ON_CREATE("LIVE_CLASS_ON_CREATE"),
    LIVE_CLASS_BEFORE_LIVE("LIVE_CLASS_BEFORE_LIVE"),
    LIVE_CLASS_ON_LIVE("LIVE_CLASS_ON_LIVE"),
    LIVE_CLASS_DELETE("LIVE_CLASS_DELETE"),
    LIVE_CLASS_ON_EDIT("LIVE_CLASS_ON_EDIT"),
    GUARDIAN_ACCOUNT_CREATED("GUARDIAN_ACCOUNT_CREATED"),
    /**
     * A learner's portal credentials are being handed to them — after an admin
     * edits their username/password, or on an explicit re-share. Bound per
     * institute AND per channel, so an institute can run a branded EMAIL
     * template and a WATI-approved WHATSAPP template off the same event.
     */
    LEARNER_CREDENTIALS_SHARED("LEARNER_CREDENTIALS_SHARED");

    private final String value;

    NotificationEventType(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    @Override
    public String toString() {
        return value;
    }
}
