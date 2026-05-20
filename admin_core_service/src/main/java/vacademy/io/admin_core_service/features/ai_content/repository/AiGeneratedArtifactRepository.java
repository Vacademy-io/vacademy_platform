package vacademy.io.admin_core_service.features.ai_content.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.ai_content.entity.AiGeneratedArtifact;

import java.util.List;

@Repository
public interface AiGeneratedArtifactRepository extends JpaRepository<AiGeneratedArtifact, String> {

    /** Show all artifacts ever generated from a given source (e.g. a BBB recording), newest first. */
    List<AiGeneratedArtifact> findBySourceIdOrderByCreatedAtDesc(String sourceId);

    /** Reverse lookup: which generation produced this assessment_id? */
    List<AiGeneratedArtifact> findByArtifactTypeAndArtifactId(String artifactType, String artifactId);
}
