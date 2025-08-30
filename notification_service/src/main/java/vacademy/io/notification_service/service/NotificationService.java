package vacademy.io.notification_service.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.common.notification.dto.AttachmentNotificationDTO;
import vacademy.io.common.notification.dto.AttachmentUsersDTO;
import vacademy.io.notification_service.dto.NotificationDTO;
import vacademy.io.notification_service.dto.NotificationToUserDTO;
import vacademy.io.notification_service.features.notification_log.entity.NotificationLog;
import vacademy.io.notification_service.features.notification_log.repository.NotificationLogRepository;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationLogRepository notificationLogRepository;
    private final EmailService emailSenderService;

    @Transactional
    public String sendNotification(NotificationDTO notificationDTO,String instituteId) {

        List<NotificationToUserDTO> users = notificationDTO.getUsers();
        List<NotificationLog> notificationLogs = new ArrayList<>(); // List to store all logs

        for (NotificationToUserDTO user : users) {
            String parsedBody = parsePlaceholders(notificationDTO.getBody(), user.getPlaceholders());
            String notificationType = notificationDTO.getNotificationType();
            String channelId = user.getChannelId();
            String userId = user.getUserId();

            // Create and add notification log to the list
            NotificationLog log = createNotificationLog(notificationType, channelId, parsedBody, notificationDTO.getSource(), notificationDTO.getSourceId(), userId);
            notificationLogs.add(log);

            // Send notification based on type
            switch (notificationType.toUpperCase()) {
                case "EMAIL":
                    emailSenderService.sendHtmlEmail(channelId, notificationDTO.getSubject(), "email-service", parsedBody,instituteId);
                    break;
                default:
                    throw new IllegalArgumentException("Unsupported notification type: " + notificationType);
            }
        }

        // Save all notification logs in a batch
        notificationLogRepository.saveAll(notificationLogs);

        return "Notification sent successfully";
    }

    private String parsePlaceholders(String body, Map<String, String> placeholders) {
        for (Map.Entry<String, String> entry : placeholders.entrySet()) {
            body = body.replace("{{" + entry.getKey() + "}}", entry.getValue());
        }
        return body;
    }

    private NotificationLog createNotificationLog(String notificationType, String channelId, String body, String source, String sourceId, String userId) {
        NotificationLog log = new NotificationLog();
        log.setNotificationType(notificationType);
        log.setChannelId(channelId);
        log.setBody(body);
        log.setSource(source);
        log.setSourceId(sourceId);
        log.setUserId(userId);
        log.setNotificationDate(LocalDateTime.now());
        return log;
    }

    @Transactional
    public Boolean sendAttachmentNotification(List<AttachmentNotificationDTO> attachmentNotificationDTOs,String instituteId) {
        List<NotificationLog> notificationLogs = new ArrayList<>();

        try {
            for (AttachmentNotificationDTO attachmentNotificationDTO : attachmentNotificationDTOs) {
                List<AttachmentUsersDTO> users = attachmentNotificationDTO.getUsers();

                for (AttachmentUsersDTO user : users) {
                    String parsedBody = parsePlaceholders(attachmentNotificationDTO.getBody(), user.getPlaceholders());
                    String notificationType = attachmentNotificationDTO.getNotificationType();
                    String channelId = user.getChannelId();
                    String userId = user.getUserId();

                    // Create and store log
                    NotificationLog log = createNotificationLog(
                            notificationType,
                            channelId,
                            parsedBody,
                            attachmentNotificationDTO.getSource(),
                            attachmentNotificationDTO.getSourceId(),
                            userId
                    );
                    notificationLogs.add(log);

                    if ("EMAIL".equalsIgnoreCase(notificationType)) {
                        Map<String, byte[]> base64AttachmentNameAndAttachment = user.getAttachments().stream()
                                .collect(Collectors.toMap(
                                        AttachmentUsersDTO.AttachmentDTO::getAttachmentName,
                                        a -> Base64.getDecoder().decode(a.getAttachment())
                                ));

                        emailSenderService.sendAttachmentEmail(
                                channelId,
                                attachmentNotificationDTO.getSubject(),
                                "email-service",
                                parsedBody,
                                base64AttachmentNameAndAttachment,
                                instituteId
                        );
                    } else {
                        throw new IllegalArgumentException("Unsupported notification type: " + notificationType);
                    }
                }
            }

            notificationLogRepository.saveAll(notificationLogs);
            return true;

        } catch (Exception e) {
            throw new RuntimeException("Failed to send notification: " + e.getMessage(), e);
        }
    }


}
