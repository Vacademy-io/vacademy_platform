package vacademy.io.admin_core_service.features.workflow.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.workflow.dto.WorkflowAiDraftRequest;
import vacademy.io.admin_core_service.features.workflow.dto.WorkflowAiDraftResponse;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowAiDraftService;

/**
 * AI-assisted workflow drafting (see WORKFLOW_AI_ASSIST_DESIGN.md). Takes a natural-language
 * goal and returns a builder-shaped draft for the admin to review + publish. Nothing is
 * persisted or activated here — this is a read-only generation step.
 */
@Slf4j
@RestController
@RequestMapping("/admin-core-service/v1/workflow")
@RequiredArgsConstructor
public class WorkflowAiDraftController {

    private final WorkflowAiDraftService workflowAiDraftService;

    @PostMapping("/ai-draft")
    public ResponseEntity<WorkflowAiDraftResponse> draft(@RequestBody WorkflowAiDraftRequest request) {
        log.info("[WorkflowAiDraft] Drafting workflow for institute {} — goal: {}",
                request != null ? request.getInstituteId() : null,
                request != null && request.getGoal() != null
                        ? request.getGoal().substring(0, Math.min(120, request.getGoal().length())) : null);
        return ResponseEntity.ok(workflowAiDraftService.draft(request));
    }
}
