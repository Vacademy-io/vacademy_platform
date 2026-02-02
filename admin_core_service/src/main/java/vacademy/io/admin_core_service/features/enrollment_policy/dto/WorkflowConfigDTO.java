package vacademy.io.admin_core_service.features.enrollment_policy.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Value;
import lombok.experimental.SuperBuilder;
import lombok.extern.jackson.Jacksonized;

import java.util.List;
import java.util.Map;

/**
 * DTO for workflow configuration in enrollment policy.
 * Contains workflow definitions and frontend actions for user interaction.
 */
@Value
@Jacksonized
@SuperBuilder
@JsonIgnoreProperties(ignoreUnknown = true)
public class WorkflowConfigDTO {
    /**
     * Whether workflow execution is enabled for this package session.
     */
    Boolean enabled;

    /**
     * List of workflows to execute.
     */
    List<WorkflowItemDTO> workflows;

    /**
     * Map of frontend actions for user interaction.
     * Key: action identifier (e.g., "verify_whatsapp", "contact_support")
     * Value: FrontendActionDTO with type, description, buttonText, and actionUrl
     * 
     * Example:
     * {
     * "verify_whatsapp": {
     * "type": "whatsapp",
     * "description": "Open your WhatsApp and verify it",
     * "buttonText": "Verify on WhatsApp",
     * "actionUrl": "https://wa.me/447466551586?text=VERIFY"
     * }
     * }
     */
    Map<String, FrontendActionDTO> frontendActions;

    /**
     * DTO for workflow item configuration.
     */
    @Value
    @Jacksonized
    @SuperBuilder
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class WorkflowItemDTO {
        String workflowId;
        String triggerOn; // ENROLLMENT, PAYMENT_SUCCESS, etc.
    }
}
