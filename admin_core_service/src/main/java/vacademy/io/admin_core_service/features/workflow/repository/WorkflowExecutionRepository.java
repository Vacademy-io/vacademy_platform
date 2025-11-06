package vacademy.io.admin_core_service.features.workflow.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.workflow.dto.WorkflowExecutionProjection;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowExecution;
import vacademy.io.admin_core_service.features.workflow.enums.WorkflowExecutionStatus;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface WorkflowExecutionRepository extends JpaRepository<WorkflowExecution, String> {

    Optional<WorkflowExecution> findByIdempotencyKey(String idempotencyKey);

    boolean existsByIdempotencyKey(String idempotencyKey);

    @Query("SELECT we FROM WorkflowExecution we WHERE we.idempotencyKey = :idempotencyKey AND we.status IN :statuses")
    Optional<WorkflowExecution> findByIdempotencyKeyAndStatusIn(@Param("idempotencyKey") String idempotencyKey,
            @Param("statuses") List<WorkflowExecutionStatus> statuses);

    List<WorkflowExecution> findByWorkflowIdOrderByStartedAtDesc(String workflowId);

    List<WorkflowExecution> findByWorkflowScheduleIdOrderByStartedAtDesc(String workflowScheduleId);

    List<WorkflowExecution> findByStatusOrderByStartedAtDesc(WorkflowExecutionStatus status);

    @Query("SELECT we FROM WorkflowExecution we WHERE we.status = :status AND we.startedAt < :cutoffTime")
    List<WorkflowExecution> findStaleExecutions(@Param("status") WorkflowExecutionStatus status,
            @Param("cutoffTime") LocalDateTime cutoffTime);

    long countByWorkflowId(String workflowId);

    long countByWorkflowScheduleId(String workflowScheduleId);

    long countByStatus(WorkflowExecutionStatus status);

    @Query("SELECT COUNT(we) FROM WorkflowExecution we WHERE we.workflow.id = :workflowId AND we.status = :status")
    long countByWorkflowIdAndStatus(@Param("workflowId") String workflowId,
            @Param("status") WorkflowExecutionStatus status);

    @Query("SELECT we.id as id, " +
            "we.idempotencyKey as idempotencyKey, " +
            "we.status as status, " +
            "we.errorMessage as errorMessage, " +
            "we.startedAt as startedAt, " +
            "we.completedAt as completedAt, " +
            "we.createdAt as createdAt, " +
            "we.updatedAt as updatedAt, " +
            "we.workflow.id as workflowId, " +
            "we.workflow.name as workflowName, " +
            "we.workflowSchedule.id as workflowScheduleId " +
            "FROM WorkflowExecution we " +
            "WHERE we.workflow.instituteId = :instituteId " +
            "AND we.workflow.id IN :workflowIds " +
            "AND (:statuses IS NULL OR we.status IN :statuses)")
    Page<WorkflowExecutionProjection> findWorkflowExecutionsWithFilters(
            @Param("instituteId") String instituteId,
            @Param("workflowIds") List<String> workflowIds,
            @Param("statuses") List<WorkflowExecutionStatus> statuses,
            Pageable pageable);
}
