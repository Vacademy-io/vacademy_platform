package vacademy.io.admin_core_service.features.workflow.dto;

import java.time.LocalDateTime;

public interface WorkflowScheduleProjection {

    String getId();

    String getWorkflowId();

    String getWorkflowName();

    String getScheduleType();

    String getCronExpression();

    Integer getIntervalMinutes();

    Integer getDayOfMonth();

    String getTimezone();

    LocalDateTime getStartDate();

    LocalDateTime getEndDate();

    String getStatus();

    LocalDateTime getLastRunAt();

    LocalDateTime getNextRunAt();

    LocalDateTime getCreatedAt();

    LocalDateTime getUpdatedAt();
}
