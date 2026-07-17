package vacademy.io.assessment_service.features.assessment.repository;

import org.springframework.data.jpa.repository.JpaRepository;
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
}
