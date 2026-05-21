package vacademy.io.admin_core_service.features.workflow.dto;

import java.time.LocalDateTime;
import java.util.Date;

public interface WorkflowWithScheduleProjection {

    // Workflow fields
    String getWorkflowId();

    String getWorkflowName();

    String getWorkflowDescription();

    String getWorkflowStatus();

    String getWorkflowType();

    String getCreatedByUserId();

    String getInstituteId();

    Date getWorkflowCreatedAt();

    Date getWorkflowUpdatedAt();

    // Schedule fields (nullable)
    String getScheduleId();

    String getScheduleType();

    String getCronExpression();

    Integer getIntervalMinutes();

    Integer getDayOfMonth();

    String getTimezone();

    LocalDateTime getScheduleStartDate();

    LocalDateTime getScheduleEndDate();

    String getScheduleStatus();

    LocalDateTime getLastRunAt();

    LocalDateTime getNextRunAt();

    LocalDateTime getScheduleCreatedAt();

    LocalDateTime getScheduleUpdatedAt();

    // Trigger fields (nullable)
    String getTriggerId();

    String getTriggerEventName();

    String getTriggerDescription();

    String getTriggerStatus();

    LocalDateTime getTriggerCreatedAt();

    LocalDateTime getTriggerUpdatedAt();

    // event_applied_type + event_id were missing in the original projection,
    // which meant any consumer needing to filter workflows by audience/batch/
    // session scope had to fetch each workflow's full DTO separately. Adding
    // them here so the audience list's LinkedWorkflowsDialog (and any future
    // entity-list-with-linked-workflows feature) can filter in one round trip.
    String getEventAppliedType();

    String getEventId();
}
