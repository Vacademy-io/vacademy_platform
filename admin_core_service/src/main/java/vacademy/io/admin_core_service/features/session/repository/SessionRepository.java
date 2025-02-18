package vacademy.io.admin_core_service.features.session.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.common.institute.entity.session.Session;

public interface SessionRepository extends JpaRepository<Session, String> {
}
