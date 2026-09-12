package vacademy.io.assessment_service.features.assessment.repository;

import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.assessment_service.features.assessment.entity.AiEvaluationProcess;

import java.util.Date;
import java.util.List;
import java.util.Optional;

@Repository
public interface AiEvaluationProcessRepository extends JpaRepository<AiEvaluationProcess, String> {

        Optional<AiEvaluationProcess> findByStudentAttempt_Id(String attemptId);

        Optional<AiEvaluationProcess> findByStudentAttemptId(String attemptId);

        /**
         * In-flight evaluations for an attempt, newest first. Used for trigger
         * idempotency so a double-click / re-trigger returns the running process
         * instead of spawning a second concurrent (full-cost) run that would
         * interleave marks into the same question_wise_marks rows.
         */
        @Query("SELECT p FROM AiEvaluationProcess p WHERE p.studentAttempt.id = :attemptId " +
                        "AND p.status IN :activeStatuses ORDER BY p.startedAt DESC")
        List<AiEvaluationProcess> findActiveByAttemptId(@Param("attemptId") String attemptId,
                        @Param("activeStatuses") List<String> activeStatuses);

        List<AiEvaluationProcess> findByStatus(String status);

        List<AiEvaluationProcess> findByStatusAndRetryCountLessThan(String status, Integer maxRetryCount);

        List<AiEvaluationProcess> findByAssessmentId(String assessmentId);

        /**
         * Non-terminal processes that started before {@code cutoff} — i.e. jobs the
         * stale-job sweeper should mark FAILED because ai_service died / never sent
         * a terminal callback, leaving them stuck forever. Rows with a null
         * started_at are excluded by the comparison, so they are never swept.
         */
        @Query("SELECT p FROM AiEvaluationProcess p " +
                        "WHERE p.status IN :statuses AND p.startedAt < :cutoff")
        List<AiEvaluationProcess> findStaleNonTerminal(@Param("statuses") List<String> statuses,
                        @Param("cutoff") Date cutoff);

        /**
         * All AI-evaluation processes for an assessment within one institute,
         * newest first, with the attempt + registration eagerly loaded for the
         * dashboard (participant name). The registration.instituteId filter scopes
         * results to the caller's institute so cross-tenant listing is impossible.
         */
        @Query("SELECT p FROM AiEvaluationProcess p " +
                        "LEFT JOIN FETCH p.studentAttempt sa " +
                        "LEFT JOIN FETCH sa.registration reg " +
                        "WHERE p.assessment.id = :assessmentId AND reg.instituteId = :instituteId " +
                        "ORDER BY p.startedAt DESC")
        List<AiEvaluationProcess> findByAssessmentAndInstitute(@Param("assessmentId") String assessmentId,
                        @Param("instituteId") String instituteId);

        /**
         * Fetch AiEvaluationProcess with eagerly loaded StudentAttempt to avoid lazy
         * initialization errors
         */
        @Query("SELECT p FROM AiEvaluationProcess p LEFT JOIN FETCH p.studentAttempt WHERE p.id = :processId")
        Optional<AiEvaluationProcess> findByIdWithStudentAttempt(@Param("processId") String processId);

        /**
         * Fetch AiEvaluationProcess with eagerly loaded StudentAttempt, Registration,
         * and Assessment
         * for the progress API
         */
        @Query("SELECT p FROM AiEvaluationProcess p " +
                        "LEFT JOIN FETCH p.studentAttempt sa " +
                        "LEFT JOIN FETCH sa.registration reg " +
                        "LEFT JOIN FETCH reg.assessment " +
                        "WHERE p.id = :processId")
        Optional<AiEvaluationProcess> findByIdWithCompleteDetails(@Param("processId") String processId);

        /**
         * Atomically claim one batch of queued jobs for this instance (V43).
         *
         * The whole point is that this is a single UPDATE, not a read-then-write.
         * Prod runs several replicas and they all poll: with a SELECT followed by a
         * separate UPDATE, two pods routinely read the same PENDING row and both start
         * grading it -- which for AI evaluation means grading the same attempt twice and
         * CHARGING THE INSTITUTE TWICE. Postgres serialises the UPDATE, so exactly one
         * pod's write lands and only it sees rows affected.
         *
         * A claim older than :staleBefore is treated as abandoned and may be re-claimed,
         * so a pod that died holding jobs does not strand them.
         *
         * Ordered oldest-first so a backlog drains fairly rather than starving the
         * earliest submissions.
         */
        @Modifying(clearAutomatically = true, flushAutomatically = true)
        @Transactional
        @Query(value = "UPDATE ai_evaluation_process SET claimed_by = :claimedBy, claimed_at = :now "
                        + "WHERE id IN ("
                        + "    SELECT id FROM ai_evaluation_process "
                        + "    WHERE status = 'PENDING' "
                        + "      AND (claimed_at IS NULL OR claimed_at < :staleBefore) "
                        + "    ORDER BY created_at "
                        + "    LIMIT :batchSize "
                        + "    FOR UPDATE SKIP LOCKED"
                        + ")", nativeQuery = true)
        int claimPendingJobs(@Param("claimedBy") String claimedBy,
                        @Param("now") Date now,
                        @Param("staleBefore") Date staleBefore,
                        @Param("batchSize") int batchSize);

        /** The rows this instance just claimed, to hand to the async worker. */
        @Query("SELECT p FROM AiEvaluationProcess p WHERE p.claimedBy = :claimedBy AND p.status = 'PENDING' "
                        + "ORDER BY p.createdAt")
        List<AiEvaluationProcess> findClaimedPending(@Param("claimedBy") String claimedBy);
}
