package vacademy.io.admin_core_service.features.live_session.repository;


import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.live_session.entity.SessionSchedule;

import java.util.UUID;

@Repository
public interface SessionScheduleRepository extends JpaRepository<SessionSchedule, String> {

    @Transactional
    void deleteBySessionId(String sessionId);
}