package vacademy.io.admin_core_service.features.enrollment_policy.notification;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.enrollment_policy.dto.NotificationConfigDTO;
import vacademy.io.admin_core_service.features.enrollment_policy.processor.EnrolmentContext;

@Slf4j
@Service
@RequiredArgsConstructor
public class PushNotificationService implements INotificationService {

    @Override
    public void sendNotification(EnrolmentContext context, NotificationConfigDTO config) {
        log.warn("PushNotificationService is not yet implemented.");
        // TODO: Implement push notification logic here
    }
}
