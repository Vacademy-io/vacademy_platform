package vacademy.io.admin_core_service.features.enrollment_policy.processor;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.enrollment_policy.dto.NotificationPolicyDTO;
import vacademy.io.admin_core_service.features.enrollment_policy.enums.NotificationTriggerType;
import vacademy.io.admin_core_service.features.enrollment_policy.notification.NotificationServiceFactory;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class PreExpiryProcessor implements IEnrolmentPolicyProcessor {

    private final NotificationServiceFactory notificationServiceFactory;

    @Override
    public void process(EnrolmentContext context) {
        long daysUntilExpiry = context.getDaysUntilExpiry();

        findNotificationsToProcess(context, daysUntilExpiry).forEach(policy -> {
            log.info("Processing pre-expiry notification for mapping: {}", context.getMapping().getId());
            notificationServiceFactory
                    .getService(policy.getNotificationConfig().getType())
                    .sendNotification(context, policy.getNotificationConfig());
        });
    }

    private List<NotificationPolicyDTO> findNotificationsToProcess(EnrolmentContext context, long daysUntilExpiry) {
        return context.getPolicy().getNotifications().stream()
                .filter(p -> NotificationTriggerType.BEFORE_EXPIRY.equals(p.getTrigger()))
                .filter(p -> p.getDaysBefore() != null && p.getDaysBefore() == daysUntilExpiry)
                .collect(Collectors.toList());
    }
}
