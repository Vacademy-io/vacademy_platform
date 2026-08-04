package vacademy.io.admin_core_service.features.telephony.controller;

import vacademy.io.admin_core_service.features.telephony.core.TtsVoiceCatalog;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.telephony.core.AiAgentService;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiAgentDTO;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;
import java.util.Map;

/**
 * Admin CRUD for the AI-agent registry (Vacademy AI personas). JWT-protected +
 * institute-membership validated (instituteId comes from the caller — without
 * the check any authenticated user could read/rewrite ANY institute's agents,
 * including their system prompts). The settings UI's "AI Agents" card and the
 * workflow builder's CALL_AI agent picker read/write here; saving auto-bridges
 * the agent into AI_CALLING_SETTING.campaigns (see AiAgentService).
 */
@RestController
@RequestMapping("/admin-core-service/v1/telephony/ai-agents")
@RequiredArgsConstructor
public class AiAgentController {

    private final AiAgentService aiAgentService;
    private final InstituteAccessValidator instituteAccessValidator;

    @GetMapping
    public ResponseEntity<List<AiAgentDTO>> list(@RequestParam("instituteId") String instituteId,
                                                 @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(aiAgentService.list(instituteId));
    }

    /** Create (id null) or update (id set). */
    @PostMapping
    public ResponseEntity<AiAgentDTO> save(@RequestBody AiAgentDTO dto,
                                           @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, dto.getInstituteId());
        return ResponseEntity.ok(aiAgentService.save(dto));
    }

    @DeleteMapping("/{agentId}")
    public ResponseEntity<Void> delete(@PathVariable("agentId") String agentId,
                                       @RequestParam("instituteId") String instituteId,
                                       @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        aiAgentService.delete(agentId, instituteId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Voices for the dropdown + tester, model-tagged so the picker can show only
     * the palette that belongs to the selected engine. Served from
     * {@link TtsVoiceCatalog} — previously three hand-maintained copies that drifted.
     * Not institute-scoped (no access check needed).
     */
    @GetMapping("/voices")
    public ResponseEntity<List<Map<String, String>>> voices() {
        return ResponseEntity.ok(TtsVoiceCatalog.all());
    }

    /** Engines we sell, each with its label, surcharge note, default and voice list. */
    @GetMapping("/tts-models")
    public ResponseEntity<List<Map<String, Object>>> ttsModels() {
        return ResponseEntity.ok(TtsVoiceCatalog.models());
    }
}
