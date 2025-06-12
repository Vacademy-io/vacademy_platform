package vacademy.io.admin_core_service.features.live_session.repository;

import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.live_session.dto.NotificationQueryDTO;
import vacademy.io.admin_core_service.features.live_session.entity.ScheduleNotification;

import java.util.List;


@Repository
public interface ScheduleNotificationRepository extends JpaRepository<ScheduleNotification, String> {

    @Transactional
    void deleteAllBySessionId(String sessionId);

    @Query(value = """
    SELECT
        sn.id AS notificationId,
        sn.session_id AS sessionId,
        sn.type AS type,
        sn.message AS message,
        sn.status AS status,
        sn.channel AS channel,
        sn.trigger_time AS triggerTime,
        sn.offset_minutes AS offsetMinutes
    FROM schedule_notifications sn
    WHERE sn.session_id = :sessionId
""", nativeQuery = true)
    List<NotificationQueryDTO> findNotificationsBySessionId(@Param("sessionId") String sessionId);


}