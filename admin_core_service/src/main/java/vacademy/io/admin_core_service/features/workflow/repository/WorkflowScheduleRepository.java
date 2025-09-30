package vacademy.io.admin_core_service.features.workflow.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowSchedule;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface WorkflowScheduleRepository extends JpaRepository<WorkflowSchedule, String> {

    /**
     * Find all active schedules
     */
    List<WorkflowSchedule> findByStatusIgnoreCase(String status);

    /**
     * Find schedules that are due for execution (next_run_at <= current time)
     */
    @Query("SELECT ws FROM WorkflowSchedule ws WHERE ws.status = 'ACTIVE' AND ws.nextRunAt <= :currentTime")
    List<WorkflowSchedule> findDueSchedules(@Param("currentTime") LocalDateTime currentTime);

    /**
     * Find schedules by workflow ID
     */
    List<WorkflowSchedule> findByWorkflowId(String workflowId);

    /**
     * Find schedules by schedule type
     */
    List<WorkflowSchedule> findByScheduleType(String scheduleType);
}