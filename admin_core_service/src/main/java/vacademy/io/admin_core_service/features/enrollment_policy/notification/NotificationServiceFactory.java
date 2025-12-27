package vacademy.io.admin_core_service.features.enrollment_policy.notification;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.enrollment_policy.enums.NotificationType;


@Component
public class NotificationServiceFactory {

    private final ApplicationContext context;

    @Autowired
    public NotificationServiceFactory(ApplicationContext context) {
        this.context = context;
    }

    public INotificationService getService(NotificationType type) {
        return switch (type) {
            case EMAIL -> context.getBean(EmailNotificationService.class);
            case WHATSAPP -> context.getBean(WhatsAppNotificationService.class);
            case PUSH -> context.getBean(PushNotificationService.class);
            default -> throw new IllegalArgumentException("Unsupported notification type: " + type);
        };
    }
}
