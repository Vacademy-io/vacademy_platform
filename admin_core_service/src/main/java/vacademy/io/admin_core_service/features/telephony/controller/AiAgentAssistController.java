package vacademy.io.admin_core_service.features.telephony.controller;

import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.telephony.core.AiAgentAssistService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;
import java.util.Map;

/**
 * LLM-assisted agent authoring (see {@link AiAgentAssistService}): draft a prompt
 * from a brief, score/critique a prompt, apply selected suggestions, revise from
 * post-call feedback (grounded in the agent's real recent calls). Each operation
 * charges a flat 1 AI credit on success. JWT + institute-membership validated —
 * the feedback path reads that institute's call transcripts.
 */
@RestController
@RequestMapping("/admin-core-service/v1/telephony/ai-agents/assist")
@RequiredArgsConstructor
public class AiAgentAssistController {

    private final AiAgentAssistService assistService;
    private final InstituteAccessValidator instituteAccessValidator;

    @Data
    public static class AssistRequest {
        private String instituteId;
        /** draft: the plain-language description of the agent. */
        private String brief;
        /** analyze/improve/feedback: the current system prompt. */
        private String prompt;
        /** draft: optional agent language. */
        private String language;
        /** improve: the suggestion "addition" texts the admin chose to apply. */
        private List<String> additions;
        /** feedback: the admin's post-call feedback. */
        private String feedback;
        /** feedback: agent id — pulls that agent's recent real calls as grounding. */
        private String agentId;
    }

    @PostMapping("/draft")
    public ResponseEntity<Map<String, Object>> draft(@RequestBody AssistRequest req,
                                                     @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, req.getInstituteId());
        return ResponseEntity.ok(assistService.draft(req.getInstituteId(), req.getBrief(), req.getLanguage()));
    }

    @PostMapping("/analyze")
    public ResponseEntity<Map<String, Object>> analyze(@RequestBody AssistRequest req,
                                                       @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, req.getInstituteId());
        return ResponseEntity.ok(assistService.analyze(req.getInstituteId(), req.getPrompt()));
    }

    @PostMapping("/improve")
    public ResponseEntity<Map<String, Object>> improve(@RequestBody AssistRequest req,
                                                       @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, req.getInstituteId());
        return ResponseEntity.ok(assistService.improve(req.getInstituteId(), req.getPrompt(), req.getAdditions()));
    }

    @PostMapping("/feedback")
    public ResponseEntity<Map<String, Object>> feedback(@RequestBody AssistRequest req,
                                                        @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, req.getInstituteId());
        return ResponseEntity.ok(assistService.feedbackRevise(
                req.getInstituteId(), req.getAgentId(), req.getPrompt(), req.getFeedback()));
    }
}
