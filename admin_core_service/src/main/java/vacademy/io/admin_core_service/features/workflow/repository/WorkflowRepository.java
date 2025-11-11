package vacademy.io.admin_core_service.features.workflow.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.workflow.entity.Workflow;
import vacademy.io.admin_core_service.features.workflow.dto.WorkflowWithScheduleProjection;

import java.util.List;

@Repository
public interface WorkflowRepository extends JpaRepository<Workflow, String> {
    List<Workflow> findByInstituteIdAndStatus(String instituteId, String status);

    List<Workflow> findByInstituteId(String instituteId);

    @Query("SELECT w.id as workflowId, w.name as workflowName, w.description as workflowDescription, " +
        "w.status as workflowStatus, w.workflowType as workflowType, w.createdByUserId as createdByUserId, " +
        "w.instituteId as instituteId, w.createdAt as workflowCreatedAt, w.updatedAt as workflowUpdatedAt, " +
        "ws.id as scheduleId, ws.scheduleType as scheduleType, ws.cronExpression as cronExpression, " +
        "ws.intervalMinutes as intervalMinutes, ws.dayOfMonth as dayOfMonth, ws.timezone as timezone, " +
        "ws.startDate as scheduleStartDate, ws.endDate as scheduleEndDate, ws.status as scheduleStatus, " +
        "ws.lastRunAt as lastRunAt, ws.nextRunAt as nextRunAt, ws.createdAt as scheduleCreatedAt, ws.updatedAt as scheduleUpdatedAt "
        +
        "FROM Workflow w LEFT JOIN WorkflowSchedule ws ON ws.workflowId = w.id " +
        "AND (:statuses IS NULL OR UPPER(ws.status) IN :statuses) " +
        "WHERE w.instituteId = :instituteId AND UPPER(w.status) = 'ACTIVE'")
    List<WorkflowWithScheduleProjection> findActiveWorkflowsWithSchedules(
        @Param("instituteId") String instituteId,
        @Param("statuses") List<String> statuses);

    @Query("SELECT w.id as workflowId, w.name as workflowName, w.description as workflowDescription, " +
        "w.status as workflowStatus, w.workflowType as workflowType, w.createdByUserId as createdByUserId, " +
        "w.instituteId as instituteId, w.createdAt as workflowCreatedAt, w.updatedAt as workflowUpdatedAt, " +
        "ws.id as scheduleId, ws.scheduleType as scheduleType, ws.cronExpression as cronExpression, " +
        "ws.intervalMinutes as intervalMinutes, ws.dayOfMonth as dayOfMonth, ws.timezone as timezone, " +
        "ws.startDate as scheduleStartDate, ws.endDate as scheduleEndDate, ws.status as scheduleStatus, " +
        "ws.lastRunAt as lastRunAt, ws.nextRunAt as nextRunAt, ws.createdAt as scheduleCreatedAt, ws.updatedAt as scheduleUpdatedAt, "
        +
        "wt.id as triggerId, wt.triggerEventName as triggerEventName, wt.description as triggerDescription, " +
        "wt.status as triggerStatus, wt.createdAt as triggerCreatedAt, wt.updatedAt as triggerUpdatedAt " +
        "FROM Workflow w LEFT JOIN WorkflowSchedule ws ON ws.workflowId = w.id " +
        "AND (:scheduleStatuses IS NULL OR UPPER(ws.status) IN :scheduleStatuses) " +
        "LEFT JOIN WorkflowTrigger wt ON wt.workflow = w " +
        "AND (:triggerStatuses IS NULL OR UPPER(wt.status) IN :triggerStatuses) " +
        "WHERE w.instituteId = :instituteId " +
        "AND ((:searchPattern IS NULL AND (:workflowStatuses IS NULL OR UPPER(w.status) IN :workflowStatuses)) " +
        "OR (:searchPattern IS NOT NULL AND (LOWER(w.name) LIKE :searchPattern " +
        "OR LOWER(COALESCE(w.description, '')) LIKE :searchPattern)))")
    Page<WorkflowWithScheduleProjection> findWorkflowsWithSchedulesPage(
        @Param("instituteId") String instituteId,
        @Param("workflowStatuses") List<String> workflowStatuses,
        @Param("scheduleStatuses") List<String> scheduleStatuses,
        @Param("triggerStatuses") List<String> triggerStatuses,
        @Param("searchPattern") String searchPattern,
        Pageable pageable);

    @Query("SELECT w FROM Workflow w WHERE w.instituteId = :instituteId " +
        "AND (:workflowStatuses IS NULL OR UPPER(w.status) IN :workflowStatuses)")
    Page<Workflow> findWorkflowsPage(
        @Param("instituteId") String instituteId,
        @Param("workflowStatuses") List<String> workflowStatuses,
        Pageable pageable);
}
