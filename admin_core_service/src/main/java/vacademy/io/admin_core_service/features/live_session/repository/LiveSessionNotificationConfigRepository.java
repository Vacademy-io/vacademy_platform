package vacademy.io.admin_core_service.features.live_session.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSessionNotificationConfig;

import java.util.List;
import java.util.Optional;

@Repository
public interface LiveSessionNotificationConfigRepository extends JpaRepository<LiveSessionNotificationConfig, String> {

    Optional<LiveSessionNotificationConfig> findBySessionIdAndNotificationType(String sessionId, String notificationType);

    List<LiveSessionNotificationConfig> findBySessionId(String sessionId);

    void deleteBySessionIdAndNotificationType(String sessionId, String notificationType);
}
