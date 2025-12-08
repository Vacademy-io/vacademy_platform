package vacademy.io.admin_core_service.features.enrollment_policy.processor;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.enrollment_policy.dto.ChannelNotificationDTO;
import vacademy.io.admin_core_service.features.enrollment_policy.dto.NotificationPolicyDTO;
import vacademy.io.admin_core_service.features.enrollment_policy.enums.NotificationTriggerType;
import vacademy.io.admin_core_service.features.enrollment_policy.enums.NotificationType;
import vacademy.io.admin_core_service.features.enrollment_policy.notification.NotificationServiceFactory;
import vacademy.io.admin_core_service.features.enrollment_policy.service.SubOrgAdminService;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.enums.UserPlanSourceEnum;
import vacademy.io.admin_core_service.features.user_subscription.service.UserPlanService;
import vacademy.io.common.auth.dto.UserDTO;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class PreExpiryProcessor implements IEnrolmentPolicyProcessor {

    private final NotificationServiceFactory notificationServiceFactory;
    private final SubOrgAdminService subOrgAdminService;
    private final UserPlanService userPlanService;

    @Override
    public void process(EnrolmentContext context) {
        long daysUntilExpiry = context.getDaysUntilExpiry();

        List<NotificationPolicyDTO> notificationsToProcess = findNotificationsToProcess(context, daysUntilExpiry);

        if (notificationsToProcess.isEmpty()) {
            return;
        }

        sendNotificationsToUser(context, notificationsToProcess);
    }

    /**
     * Sends pre-expiry notifications to individual user.
     */
    private void sendNotificationsToUser(EnrolmentContext context, List<NotificationPolicyDTO> notifications) {
        for (NotificationPolicyDTO notification : notifications) {
            try {
                log.info("Processing pre-expiry notification for mapping: {}", context.getMapping().getId());
                // Send all channel notifications for this policy
                sendChannelNotifications(context, notification);
            } catch (Exception e) {
                log.error("Error sending pre-expiry notification to user: {}", context.getUser().getId(), e);
            }
        }
    }

    /**
     * Sends notifications for all channels in a notification policy.
     */
    private void sendChannelNotifications(EnrolmentContext context, NotificationPolicyDTO policy) {
        if (policy.getNotifications() == null || policy.getNotifications().isEmpty()) {
            log.warn("No channel notifications configured in policy for trigger: {}", policy.getTrigger());
            return;
        }

        for (vacademy.io.admin_core_service.features.enrollment_policy.dto.ChannelNotificationDTO channelNotification : policy
                .getNotifications()) {
            try {
                String channel = channelNotification.getChannel();
                if (!StringUtils.hasText(channel)) {
                    channel = NotificationType.EMAIL.name(); // Default
                }

                // Get the appropriate notification service for this channel
                vacademy.io.admin_core_service.features.enrollment_policy.enums.NotificationType notificationType;
                try {
                    notificationType = vacademy.io.admin_core_service.features.enrollment_policy.enums.NotificationType
                            .valueOf(channel.toUpperCase());
                } catch (IllegalArgumentException e) {
                    log.warn("Unsupported channel type: {}, skipping", channel);
                    continue;
                }

                // Create a NotificationPolicyDTO with only this channel's notification
                NotificationPolicyDTO channelPolicy = NotificationPolicyDTO.builder()
                        .trigger(policy.getTrigger())
                        .daysBefore(policy.getDaysBefore())
                        .sendEveryNDays(policy.getSendEveryNDays())
                        .maxSends(policy.getMaxSends())
                        .notifications(List.of(channelNotification))
                        .build();

                notificationServiceFactory
                        .getService(notificationType)
                        .sendNotification(context, channelPolicy);
            } catch (Exception e) {
                log.error("Error sending notification for channel: {}", channelNotification.getChannel(), e);
            }
        }
    }

    private List<NotificationPolicyDTO> findNotificationsToProcess(EnrolmentContext context, long daysUntilExpiry) {
        return context.getPolicy().getNotifications().stream()
                .filter(p -> NotificationTriggerType.BEFORE_EXPIRY.equals(p.getTrigger()))
                .filter(p -> p.getDaysBefore() != null && p.getDaysBefore() == daysUntilExpiry)
                .collect(Collectors.toList());
    }
}
