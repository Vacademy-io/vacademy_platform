package vacademy.io.admin_core_service.features.telephony.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.telephony.core.AiAgentService;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiAgentDTO;

import java.util.List;

/**
 * Admin CRUD for the AI-agent registry (Vacademy AI personas). JWT-protected.
 * The settings UI's "AI Agents" card and the workflow builder's CALL_AI agent
 * picker read/write here; saving auto-bridges the agent into
 * AI_CALLING_SETTING.campaigns (see AiAgentService).
 */
@RestController
@RequestMapping("/admin-core-service/v1/telephony/ai-agents")
@RequiredArgsConstructor
public class AiAgentController {

    private final AiAgentService aiAgentService;

    @GetMapping
    public ResponseEntity<List<AiAgentDTO>> list(@RequestParam("instituteId") String instituteId) {
        return ResponseEntity.ok(aiAgentService.list(instituteId));
    }

    /** Create (id null) or update (id set). */
    @PostMapping
    public ResponseEntity<AiAgentDTO> save(@RequestBody AiAgentDTO dto) {
        return ResponseEntity.ok(aiAgentService.save(dto));
    }

    @DeleteMapping("/{agentId}")
    public ResponseEntity<Void> delete(@PathVariable("agentId") String agentId,
                                       @RequestParam("instituteId") String instituteId) {
        aiAgentService.delete(agentId, instituteId);
        return ResponseEntity.noContent().build();
    }
}
