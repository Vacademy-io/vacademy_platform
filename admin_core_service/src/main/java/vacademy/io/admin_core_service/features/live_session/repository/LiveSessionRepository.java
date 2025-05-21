package vacademy.io.admin_core_service.features.live_session.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSession;

import java.util.UUID;

@Repository
public interface LiveSessionRepository extends JpaRepository<LiveSession, UUID> {
}

