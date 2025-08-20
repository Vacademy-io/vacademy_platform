package vacademy.io.admin_core_service.features.workflow.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowScheduleRun;

import java.util.Optional;

@Repository
public interface WorkflowScheduleRunRepository extends JpaRepository<WorkflowScheduleRun, String> {
    Optional<WorkflowScheduleRun> findByScheduleIdAndPlannedRunAt(String scheduleId, java.util.Date plannedRunAt);
}