package vacademy.io.assessment_service.features.assessment.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentClassAiAnalysis;

import java.util.Optional;

@Repository
public interface AssessmentClassAiAnalysisRepository
        extends JpaRepository<AssessmentClassAiAnalysis, String> {

    Optional<AssessmentClassAiAnalysis> findByAssessmentIdAndInstituteId(String assessmentId,
                                                                         String instituteId);

    /**
     * Claims the right to generate, atomically.
     *
     * <p>Returns 1 if this caller won and may call the model, 0 if someone else
     * already holds it. The UNIQUE (assessment_id, institute_id) index does the
     * arbitration — Postgres serialises the insert, so exactly one caller
     * proceeds no matter how many click at once. Without this, an idempotency
     * key would still let every concurrent caller make its own model call: the
     * key only deduplicates the CHARGE, after the money has already been spent.
     *
     * <p>MUST be committed before the model call (see the REQUIRES_NEW wrapper
     * on the caller), or a request-scoped transaction keeps the row invisible
     * to the competing request until the model has already run.
     */
    @Modifying
    @Query(value = """
            INSERT INTO assessment_class_ai_analysis
                (id, assessment_id, institute_id, status, idempotency_key,
                 charge_status, credits_quoted, generated_by_user_id, claimed_at, updated_at)
            VALUES (:id, :assessmentId, :instituteId, 'GENERATING', :idempotencyKey,
                    'PENDING', :creditsQuoted, :userId, NOW(), NOW())
            ON CONFLICT (assessment_id, institute_id) DO NOTHING
            """, nativeQuery = true)
    int claim(@Param("id") String id,
              @Param("assessmentId") String assessmentId,
              @Param("instituteId") String instituteId,
              @Param("idempotencyKey") String idempotencyKey,
              @Param("creditsQuoted") java.math.BigDecimal creditsQuoted,
              @Param("userId") String userId);

    /**
     * Retakes a row stranded in GENERATING by a pod that died mid-call.
     *
     * <p>Guarded on claimed_at so it can never steal a claim that is genuinely
     * in flight; without it, one crashed generation would leave that assessment
     * permanently unbuildable.
     */
    @Modifying
    @Query(value = """
            UPDATE assessment_class_ai_analysis
               SET id = :newId,
                   status = 'GENERATING',
                   idempotency_key = :idempotencyKey,
                   charge_status = 'PENDING',
                   credits_quoted = :creditsQuoted,
                   generated_by_user_id = :userId,
                   claimed_at = NOW(),
                   updated_at = NOW()
             WHERE assessment_id = :assessmentId
               AND institute_id = :instituteId
               AND status = 'GENERATING'
               AND claimed_at < :staleBefore
            """, nativeQuery = true)
    int reclaimForStrandedClaim(@Param("newId") String newId,
                                @Param("assessmentId") String assessmentId,
                                @Param("instituteId") String instituteId,
                                @Param("idempotencyKey") String idempotencyKey,
                                @Param("creditsQuoted") java.math.BigDecimal creditsQuoted,
                                @Param("userId") String userId,
                                @Param("staleBefore") java.sql.Timestamp staleBefore);

    /**
     * Re-claims an existing row for a deliberate, paid regenerate.
     *
     * <p>Only takes a row that is READY or FAILED, so it can never steal one a
     * concurrent request is mid-generation on. The new id and key mean the
     * regenerate is charged — which is the intended behaviour for an explicit
     * Refresh, and the reason the key is the row id rather than the assessment.
     */
    @Modifying
    @Query(value = """
            UPDATE assessment_class_ai_analysis
               SET id = :newId,
                   status = 'GENERATING',
                   idempotency_key = :idempotencyKey,
                   charge_status = 'PENDING',
                   credits_quoted = :creditsQuoted,
                   generated_by_user_id = :userId,
                   claimed_at = NOW(),
                   updated_at = NOW()
             WHERE assessment_id = :assessmentId
               AND institute_id = :instituteId
               AND status IN ('READY', 'FAILED')
            """, nativeQuery = true)
    int reclaimForRegenerate(@Param("newId") String newId,
                             @Param("assessmentId") String assessmentId,
                             @Param("instituteId") String instituteId,
                             @Param("idempotencyKey") String idempotencyKey,
                             @Param("creditsQuoted") java.math.BigDecimal creditsQuoted,
                             @Param("userId") String userId);
}
