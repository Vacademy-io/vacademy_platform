package vacademy.io.admin_core_service.features.engagement.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementPromptVersion;

import java.util.List;
import java.util.Optional;

public interface EngagementPromptVersionRepository extends JpaRepository<EngagementPromptVersion, String> {

    Optional<EngagementPromptVersion> findTopByEngineIdAndStatusOrderByVersionDesc(String engineId, String status);

    Optional<EngagementPromptVersion> findTopByEngineIdOrderByVersionDesc(String engineId);

    List<EngagementPromptVersion> findByEngineIdOrderByVersionDesc(String engineId);
}
