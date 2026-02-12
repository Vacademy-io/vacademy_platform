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
    APPLICATION_FORM_SUBMISSION("APPLICATION_FORM_SUBMISSION");

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
