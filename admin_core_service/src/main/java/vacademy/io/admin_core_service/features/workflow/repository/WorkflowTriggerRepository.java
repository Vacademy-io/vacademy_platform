package vacademy.io.admin_core_service.features.workflow.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowTrigger;

import java.util.List;
import java.util.Optional;

public interface WorkflowTriggerRepository extends JpaRepository<WorkflowTrigger,String> {
    @Query("SELECT w FROM WorkflowTrigger w WHERE w.workflow.id = :workflowId")
    List<WorkflowTrigger> findByWorkflowId(@Param("workflowId") String workflowId);

    /** Idempotency for "attach workflow to course": don't create a duplicate trigger row. */
    boolean existsByWorkflow_IdAndEventIdAndTriggerEventName(String workflowId, String eventId, String triggerEventName);

    /**
     * Same match, any status -- lets a caller reactivate a previously soft-removed row
     * instead of blind-skipping (existsBy... above) or hard-inserting a duplicate.
     */
    Optional<WorkflowTrigger> findFirstByWorkflow_IdAndEventIdAndTriggerEventName(String workflowId, String eventId, String triggerEventName);

    /** Active triggers whose eventId is one of these package sessions (to show what's attached to a course). */
    @Query("SELECT w FROM WorkflowTrigger w WHERE w.eventId IN :eventIds AND w.triggerEventName = :event AND w.status = 'ACTIVE'")
    List<WorkflowTrigger> findActiveByEventIdInAndTriggerEventName(@Param("eventIds") List<String> eventIds,
                                                                   @Param("event") String event);

    /** All active triggers (any event) whose eventId is one of these package sessions. */
    @Query("SELECT w FROM WorkflowTrigger w WHERE w.eventId IN :eventIds AND w.status = 'ACTIVE'")
    List<WorkflowTrigger> findActiveByEventIdIn(@Param("eventIds") List<String> eventIds);

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

    @Query("SELECT w FROM WorkflowTrigger w WHERE w.webhookUrlSlug = :slug AND w.status = :status")
    WorkflowTrigger findByWebhookUrlSlugAndStatus(@Param("slug") String slug, @Param("status") String status);

    // Both queries also filter by workflow.status = 'ACTIVE' so DRAFT/INACTIVE
    // workflows (e.g. created by Save Draft / Test Run before publish) don't
    // accidentally fire and cause duplicate emails when an event arrives.
    @Query("""
        SELECT w FROM WorkflowTrigger w
        WHERE w.instituteId = :instituteId
          AND w.triggerEventName = :eventType
          AND w.status IN :statuses
          AND w.eventId = :eventId
          AND w.workflow.status = 'ACTIVE'
    """)
    List<WorkflowTrigger> findSpecificTriggers(
        @Param("instituteId") String instituteId,
        @Param("eventId") String eventId,
        @Param("eventType") String eventType,
        @Param("statuses") List<String> statuses
    );

    @Query("""
        SELECT w FROM WorkflowTrigger w
        WHERE w.instituteId = :instituteId
          AND w.triggerEventName = :eventType
          AND w.status IN :statuses
          AND w.eventId IS NULL
          AND w.workflow.status = 'ACTIVE'
    """)
    List<WorkflowTrigger> findGlobalTriggers(
        @Param("instituteId") String instituteId,
        @Param("eventType") String eventType,
        @Param("statuses") List<String> statuses
    );

    @Query("""
        SELECT w FROM WorkflowTrigger w
        WHERE w.instituteId = :instituteId
          AND w.triggerEventName = :eventType
          AND w.status IN :statuses
          AND w.eventId IS NULL
          AND w.workflow.status = 'ACTIVE'
    """)
    List<WorkflowTrigger> findGlobalTriggersByEventType(
        @Param("instituteId") String instituteId,
        @Param("eventType") String eventType,
        @Param("statuses") List<String> statuses
    );
}
