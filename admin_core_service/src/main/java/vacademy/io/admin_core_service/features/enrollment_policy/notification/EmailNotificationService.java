package vacademy.io.admin_core_service.features.enrollment_policy.notification;


import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.enrollment_policy.dto.EmailNotificationContentDTO;
import vacademy.io.admin_core_service.features.enrollment_policy.dto.NotificationConfigDTO;
import vacademy.io.admin_core_service.features.enrollment_policy.enums.NotificationType;
import vacademy.io.admin_core_service.features.enrollment_policy.processor.EnrolmentContext;
import vacademy.io.admin_core_service.features.notification.dto.NotificationDTO;
import vacademy.io.admin_core_service.features.notification.dto.NotificationToUserDTO;
import vacademy.io.admin_core_service.features.notification_service.service.NotificationService;
import vacademy.io.common.auth.dto.UserDTO;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailNotificationService implements INotificationService {

    @Autowired
   private NotificationService notificationService;

    @Override
    public void sendNotification(EnrolmentContext context, NotificationConfigDTO config) {
        EmailNotificationContentDTO emailConfig = (EmailNotificationContentDTO) config;
        UserDTO userDTO  = context.getUser();
        String recipientEmail = userDTO.getEmail();
        String learnerName = userDTO.getFullName();
        String courseName = context.getMapping().getPackageSession().getPackageEntity().getPackageName();
        String expiryDate = context.getEndDate().toString();
        String renewalLink = "h;ds";

        String subject = emailConfig.getContent().getSubject()
                .replace("{{learner_name}}", learnerName)
                .replace("{{course_name}}", courseName)
                .replace("{{expiry_date}}", expiryDate)
                .replace("{{renewal_link}}", renewalLink);

        String body = emailConfig.getContent().getBody()
                .replace("{{learner_name}}", learnerName)
                .replace("{{course_name}}", courseName)
                .replace("{{expiry_date}}", expiryDate)
                .replace("{{renewal_link}}", renewalLink);

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
        Map<String,String> dynamicParams = new HashMap<>();
        dynamicParams.put("learner_name", learnerName);
        dynamicParams.put("course_name", courseName);
        dynamicParams.put("expiry_date", expiryDate);
        dynamicParams.put("renewal_link", renewalLink);
        notificationToUserDTO.setPlaceholders(dynamicParams);
        notificationDTO.setUsers(List.of(notificationToUserDTO));
        notificationService.sendEmailToUsers(notificationDTO,context.getMapping().getInstitute().getId());
    }
}
