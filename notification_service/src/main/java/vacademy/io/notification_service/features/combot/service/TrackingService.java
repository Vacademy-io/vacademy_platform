package vacademy.io.notification_service.features.combot.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.notification_service.features.combot.constants.CombotConstants;
import vacademy.io.notification_service.features.combot.dto.TrackingRequest;
import vacademy.io.notification_service.features.notification_log.entity.NotificationLog;
import vacademy.io.notification_service.features.notification_log.repository.NotificationLogRepository;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class TrackingService {

    private final NotificationLogRepository notificationLogRepository;
    private final ObjectMapper objectMapper;

    public void logTrackingEvent(TrackingRequest request) {
        try {
            NotificationLog logEntry = new NotificationLog();

            // 1. Notification Type (Truncate to 20 chars to fit DB constraint)
            String type = request.getType() != null ? request.getType().toUpperCase() : "TRACKING";
            if (type.length() > 20) type = type.substring(0, 20);
            logEntry.setNotificationType(type);

            // 2. Channel ID (Required field)
            // If frontend doesn't send identifier (e.g. guest user), use "anonymous"
            String channelId = request.getChannelId();
            if (channelId == null || channelId.isBlank()) {
                channelId = request.getUserId() != null ? request.getUserId() : CombotConstants.ANONYMOUS_USER;
            }
            logEntry.setChannelId(channelId);

            // 3. User & Source Info
            logEntry.setUserId(request.getUserId());
            logEntry.setSource(request.getSource() != null ? request.getSource() : CombotConstants.SOURCE_WEB_CLIENT);
            logEntry.setSourceId(request.getSourceId());

            // 4. Body (Serialize metadata map to JSON string)
            if (request.getMetadata() != null) {
                try {
                    logEntry.setBody(objectMapper.writeValueAsString(request.getMetadata()));
                } catch (Exception e) {
                    logEntry.setBody(request.getMetadata().toString());
                }
            } else {
                logEntry.setBody("{}");
            }

            // 5. Date
            logEntry.setNotificationDate(LocalDateTime.now());

            // Save
            notificationLogRepository.save(logEntry);

        } catch (Exception e) {
            log.error("Error saving tracking log for user: {}", request.getUserId(), e);
            // We generally don't throw exception here to avoid breaking frontend logic
        }
    }
}