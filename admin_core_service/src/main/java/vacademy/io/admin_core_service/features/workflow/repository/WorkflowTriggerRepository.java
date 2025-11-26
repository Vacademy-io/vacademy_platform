package vacademy.io.admin_core_service.features.workflow.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowTrigger;

import java.util.List;

public interface WorkflowTriggerRepository extends JpaRepository<WorkflowTrigger,String> {
    @Query("SELECT w FROM WorkflowTrigger w WHERE w.instituteId = :instituteId AND w.status IN :statuses AND w.triggerEventName IN :triggerEvents")
    List<WorkflowTrigger> findByInstituteIdAndStatusInAndTriggerEventNameIn(
            String  instituteId,
            List<String> statuses,
            List<String> triggerEvents
    );

    @Query("""
    SELECT w FROM WorkflowTrigger w
    WHERE w.instituteId = :instituteId
      AND w.eventId = :eventId
      AND w.triggerEventName = :eventType
      AND w.status IN :statuses
""")
    List<WorkflowTrigger> findByInstituteIdAndEventIdAnsEventTypeAndStatusIn(
        @Param("instituteId") String instituteId,
        @Param("eventId") String eventId, // Used to match w.workflow.id
        @Param("eventType") String eventType,
        @Param("statuses") List<String> statuses
    );
}
