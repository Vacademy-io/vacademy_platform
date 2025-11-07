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
}
