package vacademy.io.admin_core_service.features.live_session.repository;

import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.admin_core_service.features.live_session.entity.SessionGuestRegistration;

public interface SessionGuestRegistrationRepository extends JpaRepository<SessionGuestRegistration, String> {

    @Transactional
    boolean existsBySessionIdAndEmail(String sessionId, String email);
}

