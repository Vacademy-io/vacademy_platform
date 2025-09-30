package vacademy.io.admin_core_service.features.workflow.automation_visualization.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;
import java.util.List;
import java.util.Map;

/**
 * Represents a single, non-technical step in a workflow sequence,
 * designed for easy rendering in a UML-style activity diagram.
 */
@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class WorkflowStepDto {

    /**
     * The user-friendly title of the step.
     * e.g., "Find All Learners", "Prepare Personalized Emails"
     */
    private String title;

    /**
     * A more detailed, plain-language explanation of what the step does.
     * e.g., "Fetches a list of learners for a specific course."
     */
    private String description;

    /**
     * A type identifier used by the frontend to display an appropriate icon.
     * e.g., 'START', 'ACTION', 'LOGIC', 'EMAIL', 'END'
     */
    private String type;

    /**
     * A map of simplified, cleaned data relevant to the step for display.
     * This contains no backend-specific syntax like #ctx.
     * e.g., { "conditions": { "7": { "subject": "..." } } }
     */
    private Map<String, Object> details;

    /**
     * For 'LOGIC' type steps, this list contains the different conditional paths
     * that the workflow can take from this point.
     */
    private List<Branch> branches;

    /**
     * Represents a conditional path leading from a LOGIC step.
     */
    @Data
    @Builder
    public static class Branch {
        /**
         * A user-friendly label for the branch condition.
         * e.g., "If Workflow is: wf_demo_morning_001"
         */
        private String condition;

        /**
         * The sequence of subsequent steps to be executed if this branch is taken.
         */
        private List<WorkflowStepDto> steps;
    }
}