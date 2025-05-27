package vacademy.io.admin_core_service.features.live_session.repository;

import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.live_session.entity.ScheduleNotification;


@Repository
public interface ScheduleNotificationRepository extends JpaRepository<ScheduleNotification, String> {

    @Transactional
    void deleteAllBySessionId(String sessionId);

}