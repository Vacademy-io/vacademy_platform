package vacademy.io.admin_core_service.features.telephony.core;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.agent.dto.ConversationSession;
import vacademy.io.admin_core_service.features.agent.service.LLMService;
import vacademy.io.admin_core_service.features.credits.client.CreditClient;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.AiCallResult;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.AiCallResultRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * LLM-assisted authoring for AI voice agents: draft a system prompt from a plain
 * brief, score/critique an existing prompt against a rubric distilled from live-call
 * failures, apply selected suggestions, and revise from admin feedback grounded in
 * the agent's real recent calls (ai_call_result transcripts/dispositions).
 *
 * All four operations are single LLM round-trips with a STRICT-JSON contract and one
 * re-emit retry (the EngagementBrainClient pattern). Suggestions are exactly that —
 * the caller (frontend) decides what to apply; nothing is force-written.
 *
 * Metering: flat {@link #COST} credit per successful operation, post-paid via
 * CreditClient.deductPrecomputed (same engine as call billing; request_type "content"
 * matches the course-assist convention and is a value the ai_token_usage CHECK
 * already allows).
 */
@Slf4j
@Service
public class AiAgentAssistService {

    private static final BigDecimal COST = BigDecimal.ONE;
    private static final int MAX_ATTEMPTS = 2;
    /** Cap of recent call records fed into feedback grounding. */
    private static final int FEEDBACK_CALLS = 12;
    /** Per-transcript char cap so 12 calls can't blow the context. */
    private static final int TRANSCRIPT_SNIPPET = 1600;

    @Autowired
    @Lazy
    private LLMService llmService;

    @Autowired
    @Lazy
    private CreditClient creditClient;

    @Autowired
    private AiCallResultRepository aiCallResultRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${agent.assist.model:anthropic/claude-sonnet-5}")
    private String model;

    // ── The rubric: every dimension is a failure mode we hit on real calls ──
    private static final String RUBRIC = """
            Score the SYSTEM PROMPT for a real-time AI PHONE agent on these dimensions (0-10 each):
            1. identity_opening — agent name + company stated and locked; opening adapts the greeting to
               the time of day; NO honorific with a missing name (a script saying 'Mr./Ms. {{name}}'
               without a guaranteed name produced 'Mr. Hello' on live calls); introduce ONCE only.
            2. goal_close — one clear objective (e.g. book a demo); a concrete close: propose specific
               slots, confirm exact day+date+time back, never claim something is booked on a vague 'okay'.
            3. conversation_mechanics — short turns, ONE question per turn, wait for answers (silence is
               not consent), pitch broken into 2-3 sentence beats with check-ins ('does that sound
               familiar?') — long monologues made real callers tune out and deflect.
            4. objection_handling — explicit handling for 'just email me', 'not interested', 'call later',
               'we already spoke', 'who are you?/which company?'; acknowledge + ONE genuine redirect to a
               small concrete next step, then concede gracefully.
            5. knowledge_answers — enough product/institute facts and FAQ answers that the agent can answer
               direct questions instead of deflecting (deflection was a top live-call complaint).
            6. language_tone — target language declared and stable; natural conversational tone; numbers
               written as words (digits like '10' were spoken 'one zero' by TTS); no jargon walls.
            7. robustness_hygiene — no unfillable placeholders (a literal '{{Day}}, {{Date}} at {{Time}}'
               rendered as empty strings live); no markdown/stage directions that would be read aloud;
               fallback/handoff behaviour defined; graceful not-interested close.
            """;

    private static final String OUTPUT_ANALYSIS = """
            "score": <0-100 overall integer>,
            "persona": "<2-5 word label you infer, e.g. 'Admissions sales caller', 'Fee-reminder assistant' — infer freely, do NOT force into fixed categories>",
            "dimensions": [ {"key": "identity_opening", "label": "Identity & opening", "score": <0-10>, "comment": "<one short sentence>"} , ... all 7 ],
            "suggestions": [ {"title": "<short imperative>", "detail": "<why, one sentence, reference the rubric>", "addition": "<ready-to-insert prompt text implementing it>"} , 3-6 items, highest impact first ],
            "derived": {
              "opening_line": "<the single spoken opening sentence implied by the prompt — natural, speakable, no placeholders that might be empty>",
              "extraction_questions": ["<3-6 things the agent should find out, each a short phrase>"],
              "dispositions": ["<4-6 call outcome labels fitting this agent, e.g. Interested, Demo_Booked, Callback, Not_Interested, Wrong_Person, Incomplete>"]
            }""";

    // ─────────────────────────────────────────────────────────────────────────

    public Map<String, Object> draft(String instituteId, String brief, String language) {
        require(brief, "brief");
        String system = """
                You are an expert architect of real-time AI PHONE agents for education businesses.
                From the admin's plain-language brief, WRITE a complete, production-quality system
                prompt for the agent, then score your own output against the rubric.

                The prompt you write must: follow every rubric dimension; be plain speakable text
                (sections with short headers are fine, but nothing that breaks when read as
                instructions); be in the agent's working language for examples; contain NO
                placeholders that might be empty at call time (no {{name}}-style tokens at all —
                write behaviour like 'if you don't know their name, ask who you're speaking with').

                """ + RUBRIC + """

                Reply with ONLY this JSON object:
                {
                "prompt": "<the full system prompt you wrote>",
                """ + OUTPUT_ANALYSIS + "\n}";
        String user = "Brief from the admin:\n" + brief
                + (language != null && !language.isBlank() ? "\nAgent language: " + language : "")
                + "\nToday's context: this agent will run on the Vacademy AI calling platform.";
        Map<String, Object> out = callJson(instituteId, system, user, "draft");
        charge(instituteId, "draft");
        return out;
    }

    public Map<String, Object> analyze(String instituteId, String prompt) {
        require(prompt, "prompt");
        String system = """
                You are an expert reviewer of system prompts for real-time AI PHONE agents.
                Critique the given prompt STRICTLY against the rubric. Be honest — a thin or
                pasted-from-a-doc prompt should score low with actionable suggestions. Never
                invent facts about the business; suggestions must be generic-safe or clearly
                marked for the admin to fill.

                """ + RUBRIC + """

                Reply with ONLY this JSON object:
                {
                """ + OUTPUT_ANALYSIS + "\n}";
        Map<String, Object> out = callJson(instituteId, system, "SYSTEM PROMPT TO REVIEW:\n" + prompt, "analyze");
        charge(instituteId, "analyze");
        return out;
    }

    public Map<String, Object> improve(String instituteId, String prompt, List<String> additions) {
        require(prompt, "prompt");
        if (additions == null || additions.isEmpty()) {
            throw new VacademyException("Select at least one suggestion to apply.");
        }
        StringBuilder adds = new StringBuilder();
        for (int i = 0; i < additions.size(); i++) {
            adds.append(i + 1).append(". ").append(additions.get(i)).append("\n");
        }
        String system = """
                You are an expert editor of system prompts for real-time AI PHONE agents.
                REWRITE the given prompt to incorporate the selected improvements. Preserve the
                author's intent, structure, language and voice — integrate, don't bolt on; remove
                any content the improvements supersede; keep it speakable and placeholder-free.
                Then score the REVISED prompt against the rubric.

                """ + RUBRIC + """

                Reply with ONLY this JSON object:
                {
                "prompt": "<the full revised prompt>",
                """ + OUTPUT_ANALYSIS + "\n}";
        String user = "CURRENT PROMPT:\n" + prompt + "\n\nIMPROVEMENTS TO INCORPORATE:\n" + adds;
        Map<String, Object> out = callJson(instituteId, system, user, "improve");
        charge(instituteId, "improve");
        return out;
    }

    public Map<String, Object> feedbackRevise(String instituteId, String agentId,
                                              String prompt, String feedback) {
        require(prompt, "prompt");
        require(feedback, "feedback");
        String callData = recentCallDigest(agentId, instituteId);
        String system = """
                You are an expert editor of system prompts for real-time AI PHONE agents.
                The admin has feedback after real calls. Using their feedback AND the actual
                recent call records provided (transcripts may reveal problems the admin didn't
                articulate — deflected questions, repeated phrases, mishandled objections),
                REWRITE the prompt to address the issues. Preserve intent, language and voice.
                Then score the revised prompt against the rubric.

                """ + RUBRIC + """

                Reply with ONLY this JSON object:
                {
                "prompt": "<the full revised prompt>",
                "change_summary": "<3-6 bullet-style sentences: what you changed and why>",
                "call_insights": ["<0-4 short observations you drew from the actual call records>"],
                """ + OUTPUT_ANALYSIS + "\n}";
        String user = "CURRENT PROMPT:\n" + prompt
                + "\n\nADMIN FEEDBACK:\n" + feedback
                + "\n\nRECENT REAL CALLS FOR THIS AGENT:\n"
                + (callData.isBlank() ? "(no call records available)" : callData);
        Map<String, Object> out = callJson(instituteId, system, user, "feedback");
        charge(instituteId, "feedback");
        return out;
    }

    // ─────────────────────────────────────────────────────────────────────────

    /** Compact digest of the agent's recent calls: disposition + summary + transcript snippet. */
    private String recentCallDigest(String agentId, String instituteId) {
        if (agentId == null || agentId.isBlank()) return "";
        try {
            List<AiCallResult> rows = aiCallResultRepository
                    .findTop12ByCampaignIdAndInstituteIdOrderByCreatedAtDesc(agentId, instituteId);
            StringBuilder sb = new StringBuilder();
            int i = 0;
            for (AiCallResult r : rows) {
                if (++i > FEEDBACK_CALLS) break;
                sb.append("--- call ").append(i)
                  .append(" | disposition=").append(nullSafe(r.getDisposition()))
                  .append(" | duration=").append(r.getDurationSeconds() == null ? "?" : r.getDurationSeconds()).append("s")
                  .append(" | interest=").append(nullSafe(r.getInterestLevel())).append(" ---\n");
                if (r.getAiSummary() != null && !r.getAiSummary().isBlank()) {
                    sb.append("summary: ").append(r.getAiSummary().strip()).append("\n");
                }
                String t = r.getTranscript();
                if (t != null && !t.isBlank()) {
                    String snip = t.strip();
                    if (snip.length() > TRANSCRIPT_SNIPPET) {
                        snip = snip.substring(0, TRANSCRIPT_SNIPPET) + " …[truncated]";
                    }
                    sb.append("transcript: ").append(snip).append("\n");
                }
            }
            return sb.toString();
        } catch (Exception e) {
            log.warn("agent-assist: could not load recent calls for agent {}: {}", agentId, e.getMessage());
            return "";
        }
    }

    /** One LLM round-trip with strict-JSON contract + one re-emit retry (brain pattern). */
    private Map<String, Object> callJson(String instituteId, String system, String user, String op) {
        List<ConversationSession.ChatMessage> history = new ArrayList<>();
        history.add(ConversationSession.ChatMessage.system(system));
        history.add(ConversationSession.ChatMessage.user(user));

        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            ConversationSession session = ConversationSession.builder()
                    .instituteId(instituteId)
                    .model(model)
                    .history(new ArrayList<>(history))
                    .build();
            LLMService.LLMResponse resp = llmService.generateChatCompletion(session);
            String raw = resp != null ? resp.getContent() : null;
            if (raw == null || raw.isBlank()) {
                throw new VacademyException("The AI assistant returned an empty response — please retry.");
            }
            try {
                JsonNode n = objectMapper.readTree(extractJson(raw));
                @SuppressWarnings("unchecked")
                Map<String, Object> out = objectMapper.convertValue(n, Map.class);
                log.info("agent-assist {} ok institute={} score={}", op, instituteId, out.get("score"));
                return out;
            } catch (Exception parseError) {
                if (attempt == MAX_ATTEMPTS) {
                    throw new VacademyException("The AI assistant produced an unreadable response — please retry.");
                }
                history.add(ConversationSession.ChatMessage.assistant(raw));
                history.add(ConversationSession.ChatMessage.user(
                        "Your previous message was not valid JSON. Reply with ONLY the JSON object "
                        + "described — no prose, no markdown fences."));
            }
        }
        throw new IllegalStateException("unreachable");
    }

    /** Post-paid flat charge; a metering failure never fails the delivered work. */
    private void charge(String instituteId, String op) {
        try {
            creditClient.deductPrecomputed(instituteId, "content",
                    "AI agent prompt assist: " + op, COST,
                    "agent-assist:" + UUID.randomUUID());
        } catch (Exception e) {
            log.warn("agent-assist: credit charge failed for {} ({}): {}", instituteId, op, e.getMessage());
        }
    }

    private static String extractJson(String raw) {
        String s = raw.strip();
        if (s.startsWith("```")) {
            int first = s.indexOf('\n');
            int lastFence = s.lastIndexOf("```");
            if (first >= 0 && lastFence > first) s = s.substring(first + 1, lastFence).strip();
        }
        int start = s.indexOf('{');
        int end = s.lastIndexOf('}');
        if (start >= 0 && end > start) return s.substring(start, end + 1);
        return s;
    }

    private static String nullSafe(String s) { return s == null ? "?" : s; }

    private static void require(String v, String field) {
        if (v == null || v.isBlank()) throw new VacademyException("Missing required field: " + field);
    }
}
