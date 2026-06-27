package vacademy.io.admin_core_service.features.workflow.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowExecutionState;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WorkflowExecutionStateRepository extends JpaRepository<WorkflowExecutionState, UUID> {

    @Query("""
        SELECT s FROM WorkflowExecutionState s
        WHERE s.status = :status
          AND s.resumeAt <= :now
        ORDER BY s.resumeAt ASC
    """)
    List<WorkflowExecutionState> findDueForResume(
        @Param("status") String status,
        @Param("now") Instant now
    );

    /**
     * Atomically claim a single WAITING row for resume.
     * Uses PESSIMISTIC_WRITE (SELECT ... FOR UPDATE SKIP LOCKED in PostgreSQL)
     * so only one pod picks up each row — prevents duplicate execution across replicas.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        SELECT s FROM WorkflowExecutionState s
        WHERE s.status = 'WAITING'
          AND s.resumeAt <= :now
        ORDER BY s.resumeAt ASC
    """)
    List<WorkflowExecutionState> findAndLockDueForResume(@Param("now") Instant now);

    /**
     * Atomically update status from WAITING to RESUMED.
     * Returns 1 if claimed, 0 if already claimed by another pod.
     */
    @Modifying
    @Transactional
    @Query("UPDATE WorkflowExecutionState s SET s.status = 'RESUMED', s.updatedAt = :now WHERE s.id = :id AND s.status = 'WAITING'")
    int claimForResume(@Param("id") UUID id, @Param("now") Instant now);

    List<WorkflowExecutionState> findByExecutionId(String executionId);

    /**
     * Cancel a lead's paused <b>AI-call retry</b> states (the CALL_AI pause/resume
     * loop) when its outcome is terminal. Deliberately scoped to the AI-call
     * {@code pause_reason}s so it never touches other workflows paused for the same
     * lead (DELAY / APPROVAL / external waits — e.g. a delayed confirmation email).
     * Native because it reads a JSON field of {@code serialized_context}.
     */
    @Modifying
    @Transactional
    @Query(value = "UPDATE workflow_execution_state SET status = 'CANCELLED', updated_at = now() " +
            "WHERE status = 'WAITING' " +
            "AND pause_reason IN ('AI_CALL_RETRY', 'AI_CALL_RECHECK') " +
            "AND serialized_context ->> 'responseId' = :responseId",
            nativeQuery = true)
    int cancelAiCallRetriesByResponseId(@Param("responseId") String responseId);

    /**
     * Read-side mirror of {@link #cancelAiCallRetriesByResponseId} — fetches the lead's
     * paused AI-call states (same scope: WAITING + AI_CALL_* pause reasons matched on the
     * serialized_context responseId) so the outcome processor can RESUME them with the
     * terminal disposition injected into context (instead of cancelling → graph dies at
     * CALL_AI). Native for the same JSON-field read reason.
     */
    @Query(value = "SELECT * FROM workflow_execution_state WHERE status='WAITING' AND pause_reason IN ('AI_CALL_RETRY','AI_CALL_RECHECK') AND serialized_context ->> 'responseId' = :responseId", nativeQuery=true)
    List<WorkflowExecutionState> findActiveAiCallStatesByResponseId(@Param("responseId") String responseId);

    /**
     * Generic (subject-agnostic) variant of {@link #findActiveAiCallStatesByResponseId}:
     * matches the paused CALL_AI states for ANY call subject by the node's subject key. We
     * match {@code subjectId} OR {@code responseId} so it works for non-lead subjects
     * (subjectId only) AND in-flight lead states paused before subjectId existed
     * (responseId only); for leads the two are equal, so this is a superset that never
     * misses. The outcome processor resumes these PAST the node carrying the call's output.
     */
    @Query(value = "SELECT * FROM workflow_execution_state WHERE status='WAITING' AND pause_reason IN ('AI_CALL_RETRY','AI_CALL_RECHECK') AND (serialized_context ->> 'subjectId' = :subject OR serialized_context ->> 'responseId' = :subject)", nativeQuery=true)
    List<WorkflowExecutionState> findActiveAiCallStatesBySubject(@Param("subject") String subject);

    /**
     * Resume a paused AI-call state with the terminal disposition injected — atomically and
     * ONLY if still WAITING. Status-guarded so it can never revert a row the resume job has
     * already claimed (RESUMED) back to WAITING (which would double-dial/assign). Returns 1
     * if resumed, 0 if already claimed. {@code resume_at=now()} so the next tick picks it up.
     */
    @Modifying
    @Transactional
    @Query(value = "UPDATE workflow_execution_state " +
            "SET status='WAITING', resume_at=now(), serialized_context=CAST(:ctxJson AS jsonb), updated_at=now() " +
            "WHERE id=:id AND status='WAITING'",
            nativeQuery = true)
    int resumeWithContextIfWaiting(@Param("id") UUID id, @Param("ctxJson") String ctxJson);
}
