package vacademy.io.notification_service.features.notification_log.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.notification_service.features.notification_log.entity.NotificationLog;

public interface NotificationLogRepository extends JpaRepository<NotificationLog, String> {
}
