package vacademy.io.admin_core_service.features.ai_content.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.ai_content.entity.AiContentExtraction;

import java.util.Date;
import java.util.List;
import java.util.Optional;

@Repository
public interface AiContentExtractionRepository extends JpaRepository<AiContentExtraction, String> {

    /** Idempotency lookup: at most one extraction per (source, type). */
    Optional<AiContentExtraction> findBySourceIdAndExtractionType(String sourceId, String extractionType);

    /** Callback handler keys on jobId — render-worker is the authoritative id-issuer. */
    Optional<AiContentExtraction> findByJobId(String jobId);

    /**
     * Watchdog query: rows whose terminal-state callback never arrived. Used by
     * TranscriptionReconciliationJob to reconcile against the worker's actual
     * state. Bounded by ORDER + a JPQL maxResults cap at the call site so a
     * runaway backlog can't sweep the worker's status endpoint.
     */
    @Query("SELECT e FROM AiContentExtraction e "
            + "WHERE e.status = :status "
            + "AND e.jobId IS NOT NULL "
            + "AND e.updatedAt < :cutoff "
            + "ORDER BY e.updatedAt ASC")
    List<AiContentExtraction> findStuckByStatus(
            @Param("status") String status,
            @Param("cutoff") Date cutoff);
}
