package vacademy.io.admin_core_service.features.workflow.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowTrigger;

import java.util.List;

public interface WorkflowTriggerRepository extends JpaRepository<WorkflowTrigger,String> {
    @Query("SELECT w FROM WorkflowTrigger w WHERE w.instituteId = :instituteId AND w.status IN :statuses AND w.triggerEventName IN :triggerEvents")
    List<WorkflowTrigger> findByInstituteIdAndStatusInAndTriggerEventNameIn(
            String  instituteId,
            List<String> statuses,
            List<String> triggerEvents
    );
}
