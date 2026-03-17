package vacademy.io.notification_service.features.combot.action.dto;

import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * Verification action - triggers a workflow to complete enrollment
 * verification.
 * When user clicks VERIFY in WhatsApp, this action triggers the specified
 * workflow.
 */
@Data
@EqualsAndHashCode(callSuper = true)
public class VerificationAction extends FlowAction {

    /**
     * Type of verification: "enrollment", "otp", "phone", etc.
     */
    private String verificationType;

    /**
     * Workflow ID to trigger for verification.
     * The workflow will update UserPlan and StudentSessionInstituteGroupMapping
     * status.
     */
    private String workflowId;
}
