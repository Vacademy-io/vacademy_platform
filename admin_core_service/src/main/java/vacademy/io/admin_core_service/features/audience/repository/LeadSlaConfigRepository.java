package vacademy.io.admin_core_service.features.audience.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.audience.entity.LeadSlaConfig;

import java.util.Optional;

@Repository
public interface LeadSlaConfigRepository extends JpaRepository<LeadSlaConfig, String> {
    Optional<LeadSlaConfig> findByInstituteId(String instituteId);
}
