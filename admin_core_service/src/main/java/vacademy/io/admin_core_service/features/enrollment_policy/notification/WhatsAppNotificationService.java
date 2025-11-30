package vacademy.io.admin_core_service.features.enrollment_policy.notification;


import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.enrollment_policy.dto.NotificationConfigDTO;
import vacademy.io.admin_core_service.features.enrollment_policy.dto.WhatsAppNotificationContentDTO;
import vacademy.io.admin_core_service.features.enrollment_policy.processor.EnrolmentContext;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class WhatsAppNotificationService implements INotificationService {

    // @Autowired private final YourActualWatiService watiService;

    @Override
    public void sendNotification(EnrolmentContext context, NotificationConfigDTO config) {
        WhatsAppNotificationContentDTO whatsAppConfig = (WhatsAppNotificationContentDTO) config;

        String recipientPhone = "1234567890"; // TODO: Get from context.getMapping().getStudent()...
        String learnerName = "Learner"; // TODO: Get from context.getMapping().getStudent()...
        String courseName = "skdjdd";
        String expiryDate = context.getEndDate().toString();
        String renewalLink = "jsdj";

        List<String> populatedParams = whatsAppConfig.getContent().getParameters().stream()
                .map(param -> param
                        .replace("{{learner_name}}", learnerName)
                        .replace("{{course_name}}", courseName)
                        .replace("{{expiry_date}}", expiryDate)
                        .replace("{{renewal_link}}", renewalLink)
                )
                .collect(Collectors.toList());

        String templateName = whatsAppConfig.getContent().getTemplateName();

        log.info("--- SENDING WHATSAPP ---");
        log.info("TO: {}", recipientPhone);
        log.info("TEMPLATE: {}", templateName);
        log.info("PARAMS: {}", populatedParams);
        log.info("--- END WHATSAPP ---");

        // watiService.sendTemplateMessage(recipientPhone, templateName, populatedParams);
    }
}
