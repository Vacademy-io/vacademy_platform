package vacademy.io.admin_core_service.features.workflow.actions;

import vacademy.io.admin_core_service.features.notification.dto.NotificationDTO;

import java.util.Map;

public interface NotificationClient {
    Map<String, Object> sendWhatsApp(Map<String, Object> item, String body);

    Map<String, Object> sendEmail(NotificationDTO notificationDTO);
}