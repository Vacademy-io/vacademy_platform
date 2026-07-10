package vacademy.io.admin_core_service.features.workflow.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.workflow.dto.WorkflowAiDraftRequest;
import vacademy.io.admin_core_service.features.workflow.dto.WorkflowAiDraftResponse;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowAiDraftService;
import vacademy.io.common.auth.model.CustomUserDetails;

/**
 * AI-assisted workflow drafting (see WORKFLOW_AI_ASSIST_DESIGN.md). Takes a natural-language
 * goal and returns a builder-shaped draft for the admin to review + publish. Nothing is
 * persisted or activated here — this is a read-only generation step.
 *
 * Guarded: the caller must be an authenticated member of the target institute
 * (InstituteAccessValidator) — otherwise any authenticated user could bill paid LLM spend to
 * an arbitrary institute. The requesting user is attributed on the LLM usage record.
 */
@Slf4j
@RestController
@RequestMapping("/admin-core-service/v1/workflow")
@RequiredArgsConstructor
public class WorkflowAiDraftController {

    private final WorkflowAiDraftService workflowAiDraftService;
    private final InstituteAccessValidator instituteAccessValidator;

    @PostMapping("/ai-draft")
    public ResponseEntity<WorkflowAiDraftResponse> draft(
            @RequestBody WorkflowAiDraftRequest request,
            @RequestAttribute("user") CustomUserDetails user) {
        if (request == null || request.getInstituteId() == null || request.getInstituteId().isBlank()) {
            return ResponseEntity.ok(WorkflowAiDraftResponse.builder()
                    .error("'instituteId' is required.").build());
        }
        // Membership check — prevents cross-tenant LLM spend / metering.
        instituteAccessValidator.validateUserAccess(user, request.getInstituteId());

        log.info("[WorkflowAiDraft] Drafting for institute {} by user {} — goal: {}",
                request.getInstituteId(), user != null ? user.getUserId() : null,
                request.getGoal() != null
                        ? request.getGoal().substring(0, Math.min(120, request.getGoal().length())) : null);
        return ResponseEntity.ok(workflowAiDraftService.draft(request, user != null ? user.getUserId() : null));
    }
}
