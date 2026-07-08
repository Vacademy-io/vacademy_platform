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
}
