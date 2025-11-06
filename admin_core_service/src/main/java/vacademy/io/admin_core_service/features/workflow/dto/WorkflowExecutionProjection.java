package vacademy.io.admin_core_service.features.workflow.dto;

import vacademy.io.admin_core_service.features.workflow.enums.WorkflowExecutionStatus;

import java.time.LocalDateTime;

public interface WorkflowExecutionProjection {

    String getId();

    String getIdempotencyKey();

    WorkflowExecutionStatus getStatus();

    String getErrorMessage();

    LocalDateTime getStartedAt();

    LocalDateTime getCompletedAt();

    LocalDateTime getCreatedAt();

    LocalDateTime getUpdatedAt();

    String getWorkflowId();

    String getWorkflowName();

    String getWorkflowScheduleId();
}
