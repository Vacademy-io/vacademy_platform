package vacademy.io.admin_core_service.features.enrollment_policy.notification;

import vacademy.io.admin_core_service.features.enrollment_policy.dto.NotificationConfigDTO;
import vacademy.io.admin_core_service.features.enrollment_policy.processor.EnrolmentContext;

public interface INotificationService {
    void sendNotification(EnrolmentContext context, NotificationConfigDTO config);
}
