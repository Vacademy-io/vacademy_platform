package vacademy.io.admin_core_service.features.telephony.publicapi.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.telephony.publicapi.entity.AiCallApiCall;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface AiCallApiCallRepository extends JpaRepository<AiCallApiCall, String> {

    Optional<AiCallApiCall> findByIdAndInstituteId(String id, String instituteId);

    Optional<AiCallApiCall> findByInstituteIdAndIdempotencyKey(String instituteId, String idempotencyKey);

    Optional<AiCallApiCall> findFirstByCallLogId(String callLogId);

    List<AiCallApiCall> findByBatchIdAndInstituteIdOrderByCreatedAtAsc(String batchId, String instituteId);

    /** Newest first, keyset-paginated on (created_at, id). */
    @Query(value = """
            SELECT * FROM ai_call_api_call c
             WHERE c.institute_id = :instituteId
               AND (:batchId IS NULL OR c.batch_id = :batchId)
               AND (:externalId IS NULL OR c.external_id = :externalId)
               AND (CAST(:since AS timestamptz) IS NULL OR c.created_at >= CAST(:since AS timestamptz))
               AND (CAST(:beforeTs AS timestamptz) IS NULL
                    OR c.created_at < CAST(:beforeTs AS timestamptz)
                    OR (c.created_at = CAST(:beforeTs AS timestamptz) AND c.id < :beforeId))
             ORDER BY c.created_at DESC, c.id DESC
             LIMIT :lim
            """, nativeQuery = true)
    List<AiCallApiCall> page(@Param("instituteId") String instituteId,
                             @Param("batchId") String batchId,
                             @Param("externalId") String externalId,
                             @Param("since") Instant since,
                             @Param("beforeTs") Instant beforeTs,
                             @Param("beforeId") String beforeId,
                             @Param("lim") int limit);

    /** Calls that may still change: the finaliser scans these. */
    @Query(value = """
            SELECT * FROM ai_call_api_call c
             WHERE c.finalized_at IS NULL AND c.created_at >= :since
             ORDER BY c.created_at ASC
             LIMIT :lim
            """, nativeQuery = true)
    List<AiCallApiCall> findOpen(@Param("since") Instant since, @Param("lim") int limit);

    /** Finished calls whose webhook delivery is due. */
    @Query(value = """
            SELECT * FROM ai_call_api_call c
             WHERE c.webhook_status = 'PENDING' AND c.webhook_next_at <= :now
             ORDER BY c.webhook_next_at ASC
             LIMIT :lim
            """, nativeQuery = true)
    List<AiCallApiCall> findWebhooksDue(@Param("now") Instant now, @Param("lim") int limit);
}
