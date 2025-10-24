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
public class WaitingPeriodProcessor implements IEnrolmentPolicyProcessor {

    private final NotificationServiceFactory notificationServiceFactory;

    @Override
    public void process(EnrolmentContext context) {
        long daysPastExpiry = context.getDaysPastExpiry();

        findNotificationsToProcess(context, daysPastExpiry).forEach(policy -> {
            log.info("Processing waiting-period notification for mapping: {}", context.getMapping().getId());
            notificationServiceFactory
                    .getService(policy.getNotificationConfig().getType())
                    .sendNotification(context, policy.getNotificationConfig());
        });
    }

    private List<NotificationPolicyDTO> findNotificationsToProcess(EnrolmentContext context, long daysPastExpiry) {
        return context.getPolicy().getNotifications().stream()
                .filter(p -> NotificationTriggerType.DURING_WAITING_PERIOD.equals(p.getTrigger()))
                .filter(p -> p.getSendEveryNDays() != null && p.getSendEveryNDays() > 0)
                .filter(p -> daysPastExpiry % p.getSendEveryNDays() == 0)
                // TODO: Add logic to check maxSends against a notification log
                .collect(Collectors.toList());
    }
}
