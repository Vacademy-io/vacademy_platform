package vacademy.io.admin_core_service.features.telephony.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.telephony.core.AiCallingConfigService;
import vacademy.io.admin_core_service.features.telephony.core.AiCallingSettingsService;
import vacademy.io.admin_core_service.features.telephony.core.TelephonyConfigCache;
import vacademy.io.admin_core_service.features.telephony.core.UserMobileResolver;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiCallingSettingsPojo;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.TelephonyCallLog;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.TelephonyCallLogRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Internal API for the Vacademy AI voice-bot service (the bot is stateless — no
 * DB). Gated by {@code InternalAuthFilter} (URI contains "internal": clientName +
 * Signature headers validated against {@code client_secret_key}; register a
 * {@code voice_bot_service} row there).
 *
 *   GET  /internal/voice-bot/call-context?corr=   — everything the bot needs at
 *        WS-connect time: lead + institute + agent persona + handoff + the
 *        webhook token for posting the end-of-call report.
 *   POST /internal/voice-bot/handoff              — the bot registered a mid-call
 *        human transfer; persists the resolved target on the call-log row, then
 *        the bot closes its stream and Plivo falls through to /plivo/ai-next.
 *
 * Phase B: the agent persona is a built-in default template parameterised by the
 * institute + AI-calling settings. Phase C replaces it with the ai_agent registry
 * (this endpoint's contract is already shaped for that).
 */
@RestController
@RequestMapping("/admin-core-service/internal/voice-bot")
public class VoiceBotInternalController {

    private static final Logger log = LoggerFactory.getLogger(VoiceBotInternalController.class);

    @Autowired private TelephonyCallLogRepository callLogRepo;
    @Autowired private TelephonyConfigCache configCache;
    @Autowired private AiCallingSettingsService aiCallingSettingsService;
    @Autowired private AiCallingConfigService aiCallingConfigService;
    @Autowired private UserMobileResolver userMobileResolver;
    @Autowired private InstituteRepository instituteRepository;
    @Autowired private vacademy.io.admin_core_service.features.telephony.core.AiAgentService aiAgentService;
    // @Lazy: AudienceService is a large service; avoid an eager bean cycle. Used only to
    // read the lead's custom/form fields so the agent can personalise the call.
    @Autowired @org.springframework.context.annotation.Lazy
    private vacademy.io.admin_core_service.features.audience.service.AudienceService audienceService;

    private final ObjectMapper mapper = new ObjectMapper();

    @GetMapping("/call-context")
    public ResponseEntity<Map<String, Object>> callContext(
            @RequestParam("corr") String corr,
            @RequestParam(value = "agent", required = false) String agentId) {

        TelephonyCallLog row = callLogRepo.findById(corr)
                .orElseThrow(() -> new VacademyException("Unknown call " + corr));
        String instituteId = row.getInstituteId();

        String instituteName = instituteRepository.findById(instituteId)
                .map(i -> i.getInstituteName()).orElse("our institute");
        String leadName = row.getUserId() == null || "UNKNOWN".equals(row.getUserId())
                ? null
                : userMobileResolver.findDisplayName(row.getUserId()).orElse(null);
        // Gender for how the bot addresses the lead (honorific + Hindi second-person):
        // the stored record gender wins; else a conservative name guess (null when
        // unknown, so the bot uses gender-neutral address instead of defaulting to "sir").
        String leadGender = (row.getUserId() == null || "UNKNOWN".equals(row.getUserId()))
                ? vacademy.io.admin_core_service.features.telephony.core.NameGender.of(leadName)
                : userMobileResolver.findGender(row.getUserId())
                        .orElseGet(() -> vacademy.io.admin_core_service.features.telephony.core
                                .NameGender.of(leadName));

        AiCallingSettingsPojo settings = aiCallingSettingsService.get(instituteId);

        // Registry agent first (agentId = ai_agent.id, minted by the settings
        // bridge as the VACADEMY_AI campaignId); built-in template as fallback.
        var registryAgent = agentId == null ? java.util.Optional.<vacademy.io.admin_core_service
                .features.telephony.persistence.entity.AiAgent>empty()
                : aiAgentService.find(agentId, instituteId)
                        .filter(a -> Boolean.TRUE.equals(a.getEnabled()));
        Map<String, Object> agent = registryAgent
                .map(a -> registryAgentMap(a, instituteName, settings))
                .orElseGet(() -> defaultAgent(agentId, instituteName, settings));

        // Handoff targets: per-agent numbers win; else the institute's voicemail/
        // fallback number (already a "reach a human" concept on the telephony config).
        List<String> handoffNumbers = new ArrayList<>(registryAgent
                .map(a -> aiAgentService.parseList(a.getHandoffNumbers()))
                .orElse(List.of()));
        if (handoffNumbers.isEmpty()) {
            configCache.get(instituteId).ifPresent(resolved -> {
                String fallback = resolved.getConfig().getInboundVoicemailNumber();
                if (fallback != null && !fallback.isBlank()) handoffNumbers.add(fallback.trim());
            });
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("corr", corr);
        out.put("instituteId", instituteId);
        out.put("instituteName", instituteName);
        out.put("direction", row.getDirection());
        // INBOUND (IVR AI_AGENT node): the person on the line is the CALLER —
        // to_number is our own DID there, so prefer from_number.
        boolean inbound = vacademy.io.admin_core_service.features.telephony.enums
                .CallDirection.INBOUND.name().equalsIgnoreCase(row.getDirection());
        out.put("leadPhone", inbound
                ? (row.getFromNumber() != null ? row.getFromNumber() : row.getToNumber())
                : (row.getToNumber() != null ? row.getToNumber() : row.getFromNumber()));
        out.put("leadName", leadName);
        if (leadGender != null) out.put("leadGender", leadGender);
        // The lead's captured form/custom fields (company, role, …) so the agent can
        // reference what it already knows instead of re-asking. Empty for unknown callers.
        Map<String, String> leadFields = row.getResponseId() == null
                ? Map.of() : audienceService.getLeadCustomFields(row.getResponseId());
        if (leadFields != null && !leadFields.isEmpty()) out.put("leadFields", leadFields);
        out.put("responseId", row.getResponseId());
        out.put("userId", row.getUserId());
        out.put("agent", agent);
        out.put("handoff", Map.of(
                "enabled", !handoffNumbers.isEmpty(),
                "numbers", handoffNumbers));
        // Prior attempts in the last 7 days (excluding this call) → the bot echoes it
        // as callRetry so the outcome classifier's exhaustion path works (Aavtaar
        // sends its own counter; our bot cannot know it).
        out.put("callRetry", callLogRepo.countRecentOutboundAttempts(
                instituteId,
                row.getUserId() == null ? "UNKNOWN" : row.getUserId(),
                vacademy.io.admin_core_service.features.telephony.enums.ProviderType.VACADEMY_AI,
                java.sql.Timestamp.from(java.time.Instant.now().minus(java.time.Duration.ofDays(7))),
                corr));
        // For the end-of-call report POST. MUST be the same effective secret the
        // receiver checks (AiVoiceWebhookController.authorized) — institute-level
        // else global — or every report 401s on envs with a global secret set.
        out.put("webhookToken", aiCallingConfigService.getEffectiveWebhookSecret(instituteId));
        return ResponseEntity.ok(out);
    }

    @PostMapping("/handoff")
    public ResponseEntity<Map<String, Object>> handoff(@RequestBody Map<String, Object> body) {
        String corr = asString(body.get("corr"));
        if (corr == null || corr.isBlank()) throw new VacademyException("corr is required");
        TelephonyCallLog row = callLogRepo.findById(corr)
                .orElseThrow(() -> new VacademyException("Unknown call " + corr));

        String number = asString(body.get("number"));
        String userId = asString(body.get("userId"));
        if ((number == null || number.isBlank()) && userId != null && !userId.isBlank()) {
            number = userMobileResolver.findMobile(userId).orElse(null);
        }
        if (number == null || number.isBlank()) {
            throw new VacademyException("No reachable handoff target");
        }

        try {
            row.setAiHandoffTarget(mapper.writeValueAsString(Map.of("number", number.trim())));
        } catch (Exception e) {
            throw new VacademyException("Could not store handoff target");
        }
        callLogRepo.save(row);
        log.info("vacademy-ai: handoff registered corr={} target={}", corr, number);
        return ResponseEntity.ok(Map.of("ok", true, "number", number.trim()));
    }

    /**
     * Persona map from a registry {@code ai_agent} row (Phase C). The agent's own
     * CONTENT (system prompt + the questions to find out) is AUTHORITATIVE — a blank
     * field means "none", NOT "inherit the built-in admissions template's values".
     * Otherwise a religious-shivir (or any non-admissions) agent that leaves
     * "Questions to find out" empty would still be told to ask "which course/class
     * are you interested in", contradicting its own prompt. Only benign STRUCTURAL
     * defaults (voice/language/dispositions vocabulary/max minutes) gap-fill.
     */
    private Map<String, Object> registryAgentMap(
            vacademy.io.admin_core_service.features.telephony.persistence.entity.AiAgent a,
            String instituteName, AiCallingSettingsPojo settings) {
        Map<String, Object> base = defaultAgent(a.getId(), instituteName, settings);
        base.put("id", a.getId());
        base.put("name", a.getName());
        if (a.getLanguage() != null) base.put("language", a.getLanguage());
        if (a.getVoice() != null) base.put("voice", a.getVoice());
        if (a.getOpeningLine() != null) base.put("openingLine", a.getOpeningLine());
        // Authoritative content — never inherit the admissions template's prompt/questions.
        base.put("systemPrompt", a.getSystemPrompt() != null && !a.getSystemPrompt().isBlank()
                ? a.getSystemPrompt() : "You are a friendly, concise phone assistant.");
        base.put("extractionQuestions", aiAgentService.parseList(a.getExtractionQuestions()));
        List<String> dispositions = aiAgentService.parseList(a.getDispositions());
        if (!dispositions.isEmpty()) base.put("dispositions", dispositions);
        if (a.getMaxCallMinutes() != null && a.getMaxCallMinutes() > 0) {
            base.put("maxCallMinutes", a.getMaxCallMinutes());
        }
        // Voice tuning (V379): consumed by the bot's build_tts. Absent = the bot's
        // global TTS_PACE / Sarvam model default.
        if (a.getPace() != null) base.put("pace", a.getPace());
        if (a.getTemperature() != null) base.put("temperature", a.getTemperature());
        return base;
    }

    /**
     * Phase B built-in persona. Dispositions are constrained to the vocabulary the
     * outcome classifier + settings already understand.
     */
    private Map<String, Object> defaultAgent(String agentId, String instituteName,
                                             AiCallingSettingsPojo settings) {
        List<String> dispositions = new ArrayList<>();
        if (settings.getAssignOnDispositions() != null) dispositions.addAll(settings.getAssignOnDispositions());
        if (settings.getStopOnDispositions() != null) dispositions.addAll(settings.getStopOnDispositions());
        if (!dispositions.contains("Callback")) dispositions.add("Callback");
        if (!dispositions.contains("Incomplete")) dispositions.add("Incomplete");

        Map<String, Object> agent = new LinkedHashMap<>();
        agent.put("id", agentId == null || agentId.isBlank() ? "default" : agentId);
        agent.put("name", "Vacademy Agent");
        agent.put("language", "hinglish");
        agent.put("voice", "priya");
        agent.put("openingLine",
                "Namaste! Main " + instituteName + " se baat kar rahi hoon. Kya aapke paas do minute hain?");
        agent.put("systemPrompt",
                "You are a warm, upbeat counsellor calling on behalf of " + instituteName + ". "
                + "Speak natural Hinglish (Roman script), 1-2 short sentences per reply, ONE question per turn. "
                + "Goal: understand the caller's learning needs, gauge interest, and answer basic questions. "
                + "Say numbers and dates as spoken words, never bare digits. "
                + "If the caller asks for a human or is annoyed, transfer. If the conversation is done, end politely.");
        agent.put("extractionQuestions", List.of(
                "What class/grade is the student in?",
                "Which course or exam are they interested in?",
                "Preferred time for a counsellor follow-up?"));
        agent.put("dispositions", dispositions);
        agent.put("maxCallMinutes", 6);
        return agent;
    }

    private static String asString(Object o) {
        return o == null ? null : o.toString();
    }
}
