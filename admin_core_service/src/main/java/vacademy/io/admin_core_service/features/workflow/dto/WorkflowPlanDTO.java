package vacademy.io.admin_core_service.features.workflow.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * The human-readable skeleton the AI proposes in a PLAN turn, for the admin to confirm before
 * any node config is filled in (see WORKFLOW_AI_ASSISTIVE_DESIGN.md §2). Carries no
 * institute-owned values — those are elicited as {@link WorkflowDecisionDTO}s.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkflowPlanDTO {
    private String summary;
    private String workflowType;   // EVENT_DRIVEN | SCHEDULED
    private String templateUsed;   // pattern name or null
    private List<PlanStep> steps;
    private List<String> warnings;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PlanStep {
        private String stepId;
        private String nodeType;
        private String title;
        private String detail;
        /** ids of the decisions that will be asked for this step (preview only). */
        private List<String> openDecisions;
    }
}
