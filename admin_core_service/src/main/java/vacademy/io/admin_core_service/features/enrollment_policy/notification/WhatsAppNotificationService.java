package vacademy.io.admin_core_service.features.enrollment_policy.notification;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.enrollment_policy.dto.ChannelNotificationDTO;
import vacademy.io.admin_core_service.features.enrollment_policy.dto.NotificationPolicyDTO;
import vacademy.io.admin_core_service.features.enrollment_policy.dto.WhatsAppNotificationContentDTO;
import vacademy.io.admin_core_service.features.enrollment_policy.enums.NotificationType;
import vacademy.io.admin_core_service.features.enrollment_policy.processor.EnrolmentContext;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class WhatsAppNotificationService implements INotificationService {

    // @Autowired private final YourActualWatiService watiService;

    @Override
    public void sendNotification(EnrolmentContext context, NotificationPolicyDTO policy) {
        if (policy.getNotifications() == null || policy.getNotifications().isEmpty()) {
            log.warn("No channel notifications configured in policy for trigger: {}", policy.getTrigger());
            return;
        }

        // Process each channel notification
        for (ChannelNotificationDTO channelNotification : policy.getNotifications()) {
            String channel = channelNotification.getChannel();

            // Only process WHATSAPP channel in WhatsAppNotificationService
            if (!NotificationType.WHATSAPP.name().equalsIgnoreCase(channel)) {
                log.debug("Skipping non-WHATSAPP channel: {} in WhatsAppNotificationService", channel);
                continue;
            }

            sendWhatsAppForChannel(context, channelNotification);
        }
    }

    /**
     * Sends WhatsApp notification for a specific channel configuration.
     */
    private void sendWhatsAppForChannel(EnrolmentContext context, ChannelNotificationDTO channelNotification) {
        String templateName = channelNotification.getTemplateName();
        String recipientPhone = "1234567890"; // TODO: Get from context.getMapping().getStudent()...
        String learnerName = "Learner"; // TODO: Get from context.getUser().getFullName()...
        String courseName = "Course Name"; // TODO: Get from context.getMapping().getPackageSession()...
        String expiryDate = context.getEndDate() != null ? context.getEndDate().toString() : "N/A";
        String renewalLink = "https://vacademy.io/renew";

        // If template name is provided, use it; otherwise use config content
        if (StringUtils.hasText(templateName)) {
            log.info("Using template: {} for WHATSAPP notification", templateName);
            // TODO: Look up template from Templates table and get parameters
        } else {
            // Fallback to content from JSON config
            if (channelNotification.getNotificationConfig() instanceof WhatsAppNotificationContentDTO whatsAppConfig
                    && whatsAppConfig.getContent() != null) {
                List<String> populatedParams = whatsAppConfig.getContent().getParameters().stream()
                        .map(param -> param
                                .replace("{{learner_name}}", learnerName)
                                .replace("{{course_name}}", courseName)
                                .replace("{{expiry_date}}", expiryDate)
                                .replace("{{renewal_link}}", renewalLink))
                        .collect(Collectors.toList());

                templateName = whatsAppConfig.getContent().getTemplateName();

                log.info("--- SENDING WHATSAPP ---");
                log.info("TO: {}", recipientPhone);
                log.info("TEMPLATE: {}", templateName);
                log.info("PARAMS: {}", populatedParams);
                log.info("--- END WHATSAPP ---");

                // watiService.sendTemplateMessage(recipientPhone, templateName,
                // populatedParams);
            } else {
                log.warn("No template name and no content in config for WHATSAPP channel, skipping notification");
            }
        }
    }
}
