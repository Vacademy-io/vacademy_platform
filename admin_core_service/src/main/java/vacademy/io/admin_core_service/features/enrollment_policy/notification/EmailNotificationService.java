package vacademy.io.admin_core_service.features.enrollment_policy.notification;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.enrollment_policy.dto.EmailNotificationContentDTO;
import vacademy.io.admin_core_service.features.enrollment_policy.dto.NotificationConfigDTO;
import vacademy.io.admin_core_service.features.enrollment_policy.dto.NotificationPolicyDTO;
import vacademy.io.admin_core_service.features.enrollment_policy.enums.NotificationType;
import vacademy.io.admin_core_service.features.enrollment_policy.processor.EnrolmentContext;
import vacademy.io.admin_core_service.features.enrollment_policy.service.EnrollmentTemplateService;
import vacademy.io.admin_core_service.features.institute.entity.Template;
import vacademy.io.admin_core_service.features.notification.dto.NotificationDTO;
import vacademy.io.admin_core_service.features.notification.dto.NotificationToUserDTO;
import vacademy.io.admin_core_service.features.notification_service.service.NotificationService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailNotificationService implements INotificationService {

    @Autowired
    private NotificationService notificationService;

    private final EnrollmentTemplateService enrollmentTemplateService;

    @Override
    public void sendNotification(EnrolmentContext context, NotificationPolicyDTO policy) {
        // Get instituteId from first mapping (all belong to same UserPlan/Institute)
        String instituteId = context.getMappings() != null && !context.getMappings().isEmpty()
            ? context.getMappings().get(0).getInstitute().getId()
            : null;
            
        if (instituteId == null) {
            log.warn("No institute ID found in context, skipping EMAIL notification");
            return;
        }

        if (policy.getNotifications() == null || policy.getNotifications().isEmpty()) {
            log.warn("No channel notifications configured in policy for trigger: {}", policy.getTrigger());
            return;
        }

        // Process each channel notification
        for (vacademy.io.admin_core_service.features.enrollment_policy.dto.ChannelNotificationDTO channelNotification : policy
                .getNotifications()) {
            String channel = channelNotification.getChannel();

            // Only process EMAIL channel in EmailNotificationService
            if (!NotificationType.EMAIL.name().equalsIgnoreCase(channel)) {
                log.debug("Skipping non-EMAIL channel: {} in EmailNotificationService", channel);
                continue;
            }

            sendEmailForChannel(context, instituteId, channelNotification);
        }
    }

    private void sendEmailForChannel(EnrolmentContext context, String instituteId,
            vacademy.io.admin_core_service.features.enrollment_policy.dto.ChannelNotificationDTO channelNotification) {
        String templateName = channelNotification.getTemplateName();
        String subject;
        String body;

        if (StringUtils.hasText(templateName)) {
            // Use template from Templates table
            Template template = enrollmentTemplateService.findByNameAndInstituteId(templateName, instituteId,
                    NotificationType.EMAIL.name());
            if (template != null) {
                subject = template.getSubject();
                body = template.getContent();

                // Replace placeholders in template content
                subject = replacePlaceholders(subject, context);
                body = replacePlaceholders(body, context);

                log.debug("Using template: {} for EMAIL channel notification", templateName);
            } else {
                throw new VacademyException(
                        "Template not found by name: " + templateName + " for institute: " + instituteId);
            }
        } else {
            // Fallback to content from JSON config
            NotificationConfigDTO config = channelNotification.getNotificationConfig();
            if (config instanceof EmailNotificationContentDTO emailConfig
                    && emailConfig.getContent() != null) {
                subject = emailConfig.getContent().getSubject();
                body = emailConfig.getContent().getBody();

                // Replace placeholders in JSON content
                subject = replacePlaceholders(subject, context);
                body = replacePlaceholders(body, context);
            } else {
                log.warn("No template name and no content in config, using default template");
                subject = enrollmentTemplateService.getEmailSubject(instituteId, null, context);
                body = enrollmentTemplateService.getEmailBody(instituteId, null, context);
            }
        }

        UserDTO userDTO = context.getUser();
        String recipientEmail = userDTO != null ? userDTO.getEmail() : null;

        if (!StringUtils.hasText(recipientEmail)) {
            log.warn("No recipient email found, skipping EMAIL notification");
            return;
        }

        sendEmailNotification(context, userDTO, recipientEmail, subject, body, instituteId);
    }

    private void sendEmailNotification(EnrolmentContext context, UserDTO userDTO,
            String recipientEmail, String subject, String body, String instituteId) {
        log.info("--- SENDING EMAIL ---");
        log.info("TO: {}", recipientEmail);
        log.info("SUBJECT: {}", subject);
        log.info("BODY: {}", body);
        log.info("--- END EMAIL ---");

        NotificationDTO notificationDTO = new NotificationDTO();
        notificationDTO.setNotificationType(NotificationType.EMAIL.name());
        notificationDTO.setBody(body);
        notificationDTO.setSubject(subject);
        notificationDTO.setSource("daily_enrollment_check");

        NotificationToUserDTO notificationToUserDTO = new NotificationToUserDTO();
        notificationToUserDTO.setChannelId(recipientEmail);
        notificationToUserDTO.setUserId(userDTO.getId());

        Map<String, String> dynamicParams = new HashMap<>();
        dynamicParams.put("learner_name", userDTO.getFullName());
        
        // Get course name from first mapping (all belong to same UserPlan)
        String courseName = context.getMappings() != null && !context.getMappings().isEmpty()
            ? enrollmentTemplateService.formatCourseName(context.getMappings().get(0).getPackageSession())
            : "Your Course";
        dynamicParams.put("course_name", courseName);
        
        dynamicParams.put("expiry_date", context.getEndDate() != null
                ? new java.text.SimpleDateFormat("yyyy-MM-dd").format(context.getEndDate())
                : "N/A");
        dynamicParams.put("renewal_link", "https://vacademy.io/renew");
        notificationToUserDTO.setPlaceholders(dynamicParams);

        notificationDTO.setUsers(List.of(notificationToUserDTO));
        notificationService.sendEmailToUsers(notificationDTO, instituteId);
    }

    /**
     * Replaces placeholders in template string with values from context.
     */
    private String replacePlaceholders(String template, EnrolmentContext context) {
        if (template == null) {
            return "";
        }

        UserDTO userDTO = context.getUser();
        String learnerName = userDTO != null && StringUtils.hasText(userDTO.getFullName())
                ? userDTO.getFullName()
                : "Learner";
        
        // Get course name from first mapping (all belong to same UserPlan)
        String courseName = context.getMappings() != null && !context.getMappings().isEmpty()
            ? enrollmentTemplateService.formatCourseName(context.getMappings().get(0).getPackageSession())
            : "Your Course";
        
        String expiryDate = context.getEndDate() != null
                ? new java.text.SimpleDateFormat("yyyy-MM-dd").format(context.getEndDate())
                : "N/A";
        String renewalLink = "https://vacademy.io/renew"; // Hardcoded for now

        return template
                .replace("{{learner_name}}", learnerName)
                .replace("{{course_name}}", courseName)
                .replace("{{expiry_date}}", expiryDate)
                .replace("{{renewal_link}}", renewalLink);
    }
}
