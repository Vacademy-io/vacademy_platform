package vacademy.io.admin_core_service.features.enrollment_policy.notification;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.enrollment_policy.dto.ChannelNotificationDTO;
import vacademy.io.admin_core_service.features.enrollment_policy.dto.NotificationPolicyDTO;
import vacademy.io.admin_core_service.features.enrollment_policy.enums.NotificationType;
import vacademy.io.admin_core_service.features.enrollment_policy.processor.EnrolmentContext;

@Slf4j
@Service
@RequiredArgsConstructor
public class PushNotificationService implements INotificationService {

    @Override
    public void sendNotification(EnrolmentContext context, NotificationPolicyDTO policy) {
        if (policy.getNotifications() == null || policy.getNotifications().isEmpty()) {
            log.warn("No channel notifications configured in policy for trigger: {}", policy.getTrigger());
            return;
        }

        // Process each channel notification
        for (ChannelNotificationDTO channelNotification : policy.getNotifications()) {
            String channel = channelNotification.getChannel();

            // Only process PUSH channel in PushNotificationService
            if (!NotificationType.PUSH.name().equalsIgnoreCase(channel)) {
                log.debug("Skipping non-PUSH channel: {} in PushNotificationService", channel);
                continue;
            }

            sendPushForChannel(context, channelNotification);
        }
    }

    /**
     * Sends push notification for a specific channel configuration.
     */
    private void sendPushForChannel(EnrolmentContext context, ChannelNotificationDTO channelNotification) {
        String templateName = channelNotification.getTemplateName();

        if (StringUtils.hasText(templateName)) {
            log.info("Using template: {} for PUSH notification", templateName);
            // TODO: Look up template from Templates table and send push notification
        } else {
            log.warn("No template name provided for PUSH channel, skipping notification");
        }

        log.warn("PushNotificationService is not yet fully implemented.");
        // TODO: Implement push notification logic here
    }
}
