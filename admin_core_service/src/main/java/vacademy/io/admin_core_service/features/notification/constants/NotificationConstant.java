package vacademy.io.admin_core_service.features.notification.constants;

public class NotificationConstant {
    public static final String EMAIL_TO_USERS = "/notification-service/internal/common/v1/send-email-to-users";
    public static final String SEND_HTML_EMAIL = "/notification-service/internal/common/v1/send-html-email";
    public static final String SEND_ATTACHMENT_EMAIL = "/notification-service/internal/common/v1/send-attachment-notification";
    public static final String SEND_WHATSAPP_TO_USER="/notification-service/whatsapp/v1/send-template-whatsapp";
    public static final String EMAIL_TO_USERS_MULTIPLE = "/notification-service/internal/common/v1/send-email-to-users/multiple";
    public static final String SEND_WHATSAPP_TO_USER_MULTIPLE="/notification-service/whatsapp/v1/send-template-whatsapp/multiple";
    public static final String PUSH_NOTIFICATION_SEND = "/notification-service/push-notifications/internal/send-to-users";
    public static final String SYSTEM_ALERT_SEND = "/notification-service/push-notifications/internal/send-system-alert";

    /** Unified send endpoint — single API for WhatsApp, Email, Push, System Alert */
    public static final String UNIFIED_SEND = "/notification-service/internal/v1/send";
    public static final String UNIFIED_SEND_STATUS = "/notification-service/internal/v1/send/{batchId}/status";

    /** Event-driven notification endpoint */
    public static final String NOTIFICATION_EVENT = "/notification-service/internal/v1/events";
}