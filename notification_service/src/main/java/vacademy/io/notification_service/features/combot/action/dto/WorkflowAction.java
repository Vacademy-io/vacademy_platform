package vacademy.io.notification_service.features.combot.action.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.List;
import java.util.Map;

/**
 * Workflow action - calls a workflow via admin-core-service API.
 */
@Data
@EqualsAndHashCode(callSuper = true)
public class WorkflowAction extends FlowAction {

    /**
     * Workflow ID to execute
     */
    @JsonProperty("workflowId")
    private String workflowId;

    /**
     * Optional parameters to pass to workflow.
     * Keys are parameter names, values are either:
     * - Static values (e.g., "constant_value")
     * - Dynamic field references (e.g., "{{phoneNumber}}", "{{userId}}")
     */
    @JsonProperty("params")
    private Map<String, String> params;

    /**
     * List of context fields to automatically include
     * e.g., ["phoneNumber", "instituteId", "userId"]
     */
    @JsonProperty("includeContext")
    private List<String> includeContext;
}
