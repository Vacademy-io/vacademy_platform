package vacademy.io.admin_core_service.features.telephony.controller;

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
     * Static catalog of Sarvam Bulbul v3 speakers for the voice dropdown + tester.
     * Source: docs.sarvam.ai bulbul model page (37 speakers, verified 2026-07-16);
     * genders per the voice-bot's speaker→grammatical-gender map (bot.py) — the
     * bot conjugates Hindi by this same mapping, so the two must agree. Not
     * institute-scoped (no access check needed).
     */
    @GetMapping("/voices")
    public ResponseEntity<List<Map<String, String>>> voices() {
        return ResponseEntity.ok(VOICES);
    }

    private static final List<Map<String, String>> VOICES = List.of(
            // female
            v("ritu", "female"), v("priya", "female"), v("neha", "female"),
            v("pooja", "female"), v("simran", "female"), v("kavya", "female"),
            v("ishita", "female"), v("shreya", "female"), v("roopa", "female"),
            v("tanya", "female"), v("shruti", "female"), v("suhani", "female"),
            v("kavitha", "female"), v("rupali", "female"),
            // male
            v("shubh", "male"), v("aditya", "male"), v("rahul", "male"),
            v("rohan", "male"), v("amit", "male"), v("dev", "male"),
            v("ratan", "male"), v("varun", "male"), v("manan", "male"),
            v("sumit", "male"), v("kabir", "male"), v("aayan", "male"),
            v("ashutosh", "male"), v("advait", "male"), v("anand", "male"),
            v("tarun", "male"), v("sunny", "male"), v("mani", "male"),
            v("gokul", "male"), v("vijay", "male"), v("mohit", "male"),
            v("rehan", "male"), v("soham", "male"));

    private static Map<String, String> v(String id, String gender) {
        return Map.of("id", id, "gender", gender, "model", "bulbul:v3");
    }
}
