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

    /**
     * Bulk id -> agent name. Saving an agent auto-registers it as a VACADEMY_AI campaign
     * with {@code campaignId = agent id}, so this resolves the agent behind a queued or
     * placed call without loading the prompts, send rules and voice config with it.
     */
    @org.springframework.data.jpa.repository.Query("SELECT a.id, a.name FROM AiAgent a WHERE a.id IN :ids")
    List<Object[]> findIdAndNameByIds(@org.springframework.data.repository.query.Param("ids") java.util.Collection<String> ids);
}
