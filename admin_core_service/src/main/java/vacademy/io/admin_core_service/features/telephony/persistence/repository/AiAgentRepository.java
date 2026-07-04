package vacademy.io.admin_core_service.features.telephony.persistence.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.AiAgent;

import java.util.List;
import java.util.Optional;

@Repository
public interface AiAgentRepository extends JpaRepository<AiAgent, String> {

    List<AiAgent> findByInstituteIdOrderByCreatedAtDesc(String instituteId);

    Optional<AiAgent> findByIdAndInstituteId(String id, String instituteId);
}
