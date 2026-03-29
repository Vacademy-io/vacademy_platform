package vacademy.io.admin_core_service.features.audience.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.audience.entity.AudienceCommunication;

@Repository
public interface AudienceCommunicationRepository extends JpaRepository<AudienceCommunication, String> {

    Page<AudienceCommunication> findByAudienceIdOrderByCreatedAtDesc(String audienceId, Pageable pageable);
}
