package vacademy.io.admin_core_service.features.workflow.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.workflow.enums.ExecutionLogStatus;
import vacademy.io.admin_core_service.features.workflow.enums.WorkflowExecutionStatus;

import java.time.Instant;
import java.util.List;

/**
 * One enrollment workflow execution (e.g. a {@code LEARNER_BATCH_ENROLLMENT}
 * run) along with its ordered per-node steps. Consumed by the admin dashboard to
 * render the workflow as a checklist of ticks/crosses with a clickable error per
 * failed step.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EnrollmentWorkflowRunDTO {

    @JsonProperty("execution_id")
    private String executionId;

    @JsonProperty("workflow_id")
    private String workflowId;

    @JsonProperty("workflow_name")
    private String workflowName;

    /** Trigger event name parsed from the idempotency key, e.g. LEARNER_BATCH_ENROLLMENT. */
    @JsonProperty("event_name")
    private String eventName;

    /** The eventId encoded in the idempotency key (the package session id for enrollment). */
    @JsonProperty("event_id")
    private String eventId;

    @JsonProperty("status")
    private WorkflowExecutionStatus status;

    @JsonProperty("error_message")
    private String errorMessage;

    @JsonProperty("started_at")
    private Instant startedAt;

    @JsonProperty("completed_at")
    private Instant completedAt;

    @JsonProperty("steps")
    private List<Step> steps;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Step {

        @JsonProperty("log_id")
        private String logId;

        @JsonProperty("node_template_id")
        private String nodeTemplateId;

        /** Human-readable node name resolved from node_template (falls back to node type). */
        @JsonProperty("node_name")
        private String nodeName;

        @JsonProperty("node_type")
        private String nodeType;

        @JsonProperty("status")
        private ExecutionLogStatus status;

        @JsonProperty("error_message")
        private String errorMessage;

        @JsonProperty("error_type")
        private String errorType;

        @JsonProperty("started_at")
        private Instant startedAt;

        @JsonProperty("completed_at")
        private Instant completedAt;

        @JsonProperty("execution_time_ms")
        private Long executionTimeMs;
    }
}
