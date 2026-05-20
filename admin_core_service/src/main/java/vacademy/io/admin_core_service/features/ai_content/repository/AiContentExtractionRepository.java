package vacademy.io.admin_core_service.features.ai_content.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.ai_content.entity.AiContentExtraction;

import java.util.Optional;

@Repository
public interface AiContentExtractionRepository extends JpaRepository<AiContentExtraction, String> {

    /** Idempotency lookup: at most one extraction per (source, type). */
    Optional<AiContentExtraction> findBySourceIdAndExtractionType(String sourceId, String extractionType);

    /** Callback handler keys on jobId — render-worker is the authoritative id-issuer. */
    Optional<AiContentExtraction> findByJobId(String jobId);
}
