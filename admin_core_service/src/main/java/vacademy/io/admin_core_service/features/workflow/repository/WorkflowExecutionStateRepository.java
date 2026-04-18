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

public interface WorkflowExecutionStateRepository extends JpaRepository<WorkflowExecutionState, String> {

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
    int claimForResume(@Param("id") String id, @Param("now") Instant now);

    List<WorkflowExecutionState> findByExecutionId(String executionId);
}
