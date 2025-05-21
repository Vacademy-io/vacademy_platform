package vacademy.io.admin_core_service.features.live_session.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSessionParticipants;

import java.util.List;
import java.util.UUID;

@Repository
public interface LiveSessionParticipantRepository extends JpaRepository<LiveSessionParticipants, UUID> {
}
