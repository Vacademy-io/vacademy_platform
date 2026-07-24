package vacademy.io.admin_core_service.features.workflow.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

/**
 * Request for AI-assisted workflow drafting (see WORKFLOW_AI_ASSIST_DESIGN.md).
 * The admin describes an automation in {@code goal}; if the drafter previously
 * returned clarifyingQuestions, the answers come back in {@code answers} (each a
 * {questionId, value} map, e.g. a resolved audienceId/batchId).
 */
@Data
public class WorkflowAiDraftRequest {
    private String goal;
    private String instituteId;
    private List<Map<String, Object>> answers;

    /**
     * Assistive mode (see WORKFLOW_AI_ASSISTIVE_DESIGN.md §6):
     *  - null / "DRAFT" → legacy single-shot draft (backward compatible).
     *  - "PLAN"  → return a plan + decisions + skeleton (no filled config).
     *  - "BUILD" → deterministically assemble the final workflow from
     *              {@code skeleton} + {@code decisions} + {@code decisionAnswers}
     *              (echoed back from the PLAN turn — this endpoint stays stateless).
     */
    private String mode;

    /** BUILD only: the skeleton returned by the PLAN turn, echoed back verbatim. */
    private WorkflowBuilderDTO skeleton;

    /** BUILD only: the decision manifest returned by the PLAN turn, echoed back verbatim. */
    private List<WorkflowDecisionDTO> decisions;

    /** BUILD only: the admin's answers, one per required decision. */
    private List<DecisionAnswer> decisionAnswers;

    @Data
    public static class DecisionAnswer {
        private String id;
        /** String, List<String> (multi), or Map (var-map) depending on the decision kind. */
        private Object value;
    }
}
