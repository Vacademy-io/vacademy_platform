package vacademy.io.admin_core_service.features.mentorship.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.mentorship.entity.MentorshipNotificationLog;

import java.sql.Timestamp;

@Repository
public interface MentorshipNotificationLogRepository extends JpaRepository<MentorshipNotificationLog, String> {

    boolean existsByNotificationTypeAndRefId(String notificationType, String refId);

    /** Newest send for this ref — gates the check-in re-nudge cadence. Null when never sent. */
    @Query("SELECT MAX(l.sentAt) FROM MentorshipNotificationLog l "
            + "WHERE l.notificationType = :type AND l.refId = :refId")
    Timestamp lastSentAt(@Param("type") String type, @Param("refId") String refId);
}
