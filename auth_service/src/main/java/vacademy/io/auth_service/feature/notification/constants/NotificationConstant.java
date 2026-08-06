package vacademy.io.auth_service.feature.notification.constants;

public class NotificationConstant {
    public static final String SEND_EMAIL_OTP = "/notification-service/internal/v1/send-email-otp";
    public static final String VERIFY_EMAIL_OTP = "/notification-service/internal/v1/verify-email-otp";
    public static final String SEND_WHATSAPP_OTP = "/notification-service/internal/v1/send-whatsapp-otp";
    public static final String SEND_PLATFORM_DEFAULT_WHATSAPP_OTP = "/notification-service/internal/v1/send-platform-default-whatsapp-otp";
    public static final String VERIFY_WHATSAPP_OTP = "/notification-service/internal/v1/verify-whatsapp-otp";
    public static final String UNIFIED_SEND = "/notification-service/internal/v1/send";

    /**
     * Event name stamped as the send source on team/admin invitation emails, so institutes can
     * select them as a CC/BCC copy trigger.
     *
     * <p>Must stay identical to the {@code TEAM_INVITE} entry in admin-core's
     * {@code NotificationEventType} and in the frontend's {@code EMAIL_CC_TRIGGERS} catalogue —
     * notification-service's {@code EmailCcResolver} matches these by exact string.
     */
    public static final String EVENT_TEAM_INVITE = "TEAM_INVITE";

    /**
     * Event name for the learner enrollment email ("Course Enrollment - <institute>"), sent from
     * {@code AuthService.sendLearnerEnrollment*Email} for both new and existing learners.
     *
     * <p>This is the enrollment mail most institutes actually receive — admin-core's
     * DynamicNotificationService LEARNER_ENROLL path only fires where an institute has bound a
     * notification_event_config template. Both must stamp the SAME name so a single
     * "Course enrollment" copy trigger covers whichever path an institute uses.
     */
    public static final String EVENT_LEARNER_ENROLL = "LEARNER_ENROLL";
}
