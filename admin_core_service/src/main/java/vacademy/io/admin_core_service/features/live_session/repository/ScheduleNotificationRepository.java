package vacademy.io.admin_core_service.features.live_session.repository;

import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.live_session.dto.NotificationQueryDTO;
import vacademy.io.admin_core_service.features.live_session.entity.ScheduleNotification;

import java.time.LocalDateTime;
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

    @Query(value = """
        SELECT *
        FROM schedule_notifications
        WHERE status = 'PENDING'
          AND trigger_time IS NOT NULL
          AND (trigger_time BETWEEN :now AND :windowEnd)
        ORDER BY trigger_time ASC
        LIMIT 500
    """, nativeQuery = true)
    List<ScheduleNotification> findPendingBetween(@Param("now") LocalDateTime now,
                                                  @Param("windowEnd") LocalDateTime windowEnd);

    @Query(value = """
        SELECT *
        FROM schedule_notifications
        WHERE status = 'PENDING'
          AND trigger_time IS NOT NULL
          AND trigger_time < :now
        ORDER BY trigger_time ASC
        LIMIT 1000
    """, nativeQuery = true)
    List<ScheduleNotification> findPastDue(@Param("now") LocalDateTime now);

    @Modifying
    @Transactional
    @Query(value = "UPDATE schedule_notifications SET status = 'DISABLE' WHERE schedule_id IN (:scheduleIds)", nativeQuery = true)
    int disableNotificationsByScheduleIds(@Param("scheduleIds") List<String> scheduleIds);

    @Modifying
    @Transactional
    @Query(value = "UPDATE schedule_notifications SET status = 'DISABLE' WHERE session_id = :sessionId", nativeQuery = true)
    int disableNotificationsBySessionId(@Param("sessionId") String sessionId);


}