package vacademy.io.notification_service.features.notification_log.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.notification_service.features.notification_log.entity.NotificationLog;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface NotificationLogRepository extends JpaRepository<NotificationLog, String> {
    
    // Find original email sending log for a recipient before SES event time
    Optional<NotificationLog> findTopByChannelIdAndNotificationTypeAndNotificationDateBeforeOrderByNotificationDateDesc(
            String channelId, String notificationType, LocalDateTime before);
    
    // Removed duplicate checking methods - back to original behavior
            
    // Debug method: Find any EMAIL logs for a recipient (for debugging)
    Optional<NotificationLog> findTopByChannelIdAndNotificationTypeOrderByNotificationDateDesc(
            String channelId, String notificationType);
            
    // Debug method: Find any logs for a recipient (for debugging)
    Optional<NotificationLog> findTopByChannelIdOrderByNotificationDateDesc(String channelId);
    
    // Debug method: Find all recent EMAIL logs for comparison
    List<NotificationLog> findTop10ByNotificationTypeOrderByNotificationDateDesc(String notificationType);
    
    // Find recent EMAIL logs within time window
    Optional<NotificationLog> findTopByNotificationTypeAndNotificationDateAfterOrderByNotificationDateDesc(
            String notificationType, LocalDateTime after);
    
    // All duplicate checking methods removed
}
