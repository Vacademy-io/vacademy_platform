package vacademy.io.admin_core_service.features.notification.constants;

public class NotificationConstant {

    /** Unified send endpoint — single API for WhatsApp, Email, Push, System Alert */
    public static final String UNIFIED_SEND = "/notification-service/internal/v1/send";

    /** Event-driven notification endpoint */
    public static final String NOTIFICATION_EVENT = "/notification-service/internal/v1/events";
}