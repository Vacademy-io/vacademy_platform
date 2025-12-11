package vacademy.io.admin_core_service.features.workflow.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.workflow.enums.ExecutionLogStatus;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkflowExecutionLogDTO {

    @JsonProperty("id")
    private String id;

    @JsonProperty("workflow_execution_id")
    private String workflowExecutionId;

    @JsonProperty("node_template_id")
    private String nodeTemplateId;

    @JsonProperty("node_type")
    private String nodeType;

    @JsonProperty("status")
    private ExecutionLogStatus status;

    @JsonProperty("started_at")
    private Instant startedAt;

    @JsonProperty("completed_at")
    private Instant completedAt;

    @JsonProperty("execution_time_ms")
    private Long executionTimeMs;

    @JsonProperty("details")
    private JsonNode details; // Parsed JSON object

    @JsonProperty("error_message")
    private String errorMessage;

    @JsonProperty("error_type")
    private String errorType;

    @JsonProperty("created_at")
    private Instant createdAt;

    @JsonProperty("updated_at")
    private Instant updatedAt;
}
