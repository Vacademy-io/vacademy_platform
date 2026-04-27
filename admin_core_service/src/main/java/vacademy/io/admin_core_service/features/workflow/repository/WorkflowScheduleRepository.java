package vacademy.io.admin_core_service.features.workflow.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.workflow.dto.WorkflowScheduleProjection;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowSchedule;

import java.time.Instant;
import java.util.List;

@Repository
public interface WorkflowScheduleRepository extends JpaRepository<WorkflowSchedule, String> {

        /**
         * Find all active schedules
         */
        List<WorkflowSchedule> findByStatusIgnoreCase(String status);

        /**
         * Find schedules that are due for execution (next_run_at <= current time).
         * Also filters by workflow.status = 'ACTIVE' so schedules attached to
         * DRAFT/INACTIVE workflows (e.g. created by Save Draft / Test Run before
         * publish) don't fire and cause duplicate workflow runs.
         */
        @Query("""
            SELECT ws FROM WorkflowSchedule ws, Workflow w
            WHERE ws.workflowId = w.id
              AND ws.status = 'ACTIVE'
              AND w.status = 'ACTIVE'
              AND ws.nextRunAt <= :currentTime
        """)
        List<WorkflowSchedule> findDueSchedules(@Param("currentTime") Instant currentTime);

        /**
         * Find schedules by workflow ID
         */
        List<WorkflowSchedule> findByWorkflowId(String workflowId);

        List<WorkflowSchedule> findByWorkflowIdAndStatus(String workflowId, String status);

        /**
         * Find schedules by schedule type
         */
        List<WorkflowSchedule> findByScheduleType(String scheduleType);

        @Query("SELECT ws.id as id, " +
                        "ws.workflowId as workflowId, " +
                        "w.name as workflowName, " +
                        "ws.scheduleType as scheduleType, " +
                        "ws.cronExpression as cronExpression, " +
                        "ws.intervalMinutes as intervalMinutes, " +
                        "ws.dayOfMonth as dayOfMonth, " +
                        "ws.timezone as timezone, " +
                        "ws.startDate as startDate, " +
                        "ws.endDate as endDate, " +
                        "ws.status as status, " +
                        "ws.lastRunAt as lastRunAt, " +
                        "ws.nextRunAt as nextRunAt, " +
                        "ws.createdAt as createdAt, " +
                        "ws.updatedAt as updatedAt " +
                        "FROM WorkflowSchedule ws " +
                        "JOIN Workflow w ON ws.workflowId = w.id " +
                        "WHERE w.instituteId = :instituteId " +
                        "AND (:workflowIds IS NULL OR ws.workflowId IN :workflowIds) " +
                        "AND (:statuses IS NULL OR UPPER(ws.status) IN :statuses)")
        Page<WorkflowScheduleProjection> findWorkflowSchedulesWithFilters(
                        @Param("instituteId") String instituteId,
                        @Param("workflowIds") List<String> workflowIds,
                        @Param("statuses") List<String> statuses,
                        Pageable pageable);

        @Query("SELECT ws.id as id, " +
                        "ws.workflowId as workflowId, " +
                        "w.name as workflowName, " +
                        "ws.scheduleType as scheduleType, " +
                        "ws.cronExpression as cronExpression, " +
                        "ws.intervalMinutes as intervalMinutes, " +
                        "ws.dayOfMonth as dayOfMonth, " +
                        "ws.timezone as timezone, " +
                        "ws.startDate as startDate, " +
                        "ws.endDate as endDate, " +
                        "ws.status as status, " +
                        "ws.lastRunAt as lastRunAt, " +
                        "ws.nextRunAt as nextRunAt, " +
                        "ws.createdAt as createdAt, " +
                        "ws.updatedAt as updatedAt " +
                        "FROM WorkflowSchedule ws " +
                        "JOIN Workflow w ON ws.workflowId = w.id " +
                        "WHERE w.instituteId = :instituteId " +
                        "AND ws.workflowId IN :workflowIds " +
                        "AND (:statuses IS NULL OR UPPER(ws.status) IN :statuses)")
        List<WorkflowScheduleProjection> findWorkflowSchedulesForWorkflows(
                        @Param("instituteId") String instituteId,
                        @Param("workflowIds") List<String> workflowIds,
                        @Param("statuses") List<String> statuses);
}
