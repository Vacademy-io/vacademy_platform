package vacademy.io.notification_service.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.notification_service.dto.NotificationDTO;
import vacademy.io.notification_service.dto.NotificationToUserDTO;
import vacademy.io.notification_service.features.notification_log.entity.NotificationLog;
import vacademy.io.notification_service.features.notification_log.repository.NotificationLogRepository;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationLogRepository notificationLogRepository;
    private final EmailService emailSenderService;

    @Transactional
    public String sendNotification(NotificationDTO notificationDTO) {
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
                    emailSenderService.sendHtmlEmail(channelId, notificationDTO.getSubject(), "email-service", parsedBody);
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
}