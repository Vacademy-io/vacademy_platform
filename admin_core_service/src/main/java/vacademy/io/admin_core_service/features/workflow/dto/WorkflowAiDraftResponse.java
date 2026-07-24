package vacademy.io.admin_core_service.features.workflow.dto;

import lombok.Builder;
import lombok.Data;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowValidationService;

import java.util.List;
import java.util.Map;

/**
 * Response from the AI workflow drafter. {@code workflow} is a builder-shaped draft the
 * frontend loads straight into the canvas for human review (it is NOT persisted — the admin
 * publishes it via the normal create flow). {@code rationale} explains each node in plain
 * English; {@code clarifyingQuestions} (when non-empty) means the drafter needs the admin to
 * resolve an entity (e.g. which audience) before a complete draft can be produced.
 */
@Data
@Builder
public class WorkflowAiDraftResponse {
    /** PLAN_PROPOSAL | DECISION_REQUEST | FINAL_WORKFLOW | null (legacy draft). */
    private String turnType;
    /** PLAN turn: the skeleton for the admin to confirm before decisions are filled. */
    private WorkflowPlanDTO plan;
    /** PLAN turn: the typed decisions to render as real pickers. */
    private List<WorkflowDecisionDTO> decisions;
    /** PLAN turn: the placeholder workflow, echoed back on BUILD (do not load onto canvas). */
    private WorkflowBuilderDTO skeleton;

    private WorkflowBuilderDTO workflow;
    private List<Map<String, Object>> rationale;
    private List<Map<String, Object>> clarifyingQuestions;
    private String templateUsed;
    /** Validation errors remaining after the repair loop (empty = clean draft). */
    private List<WorkflowValidationService.ValidationError> validationErrors;
    /** Non-blocking cautions surfaced to the admin (e.g. INVITE_FORM_FILL fires on view). */
    private List<String> warnings;
    /** Set when drafting failed outright (LLM/parse error). */
    private String error;
}
