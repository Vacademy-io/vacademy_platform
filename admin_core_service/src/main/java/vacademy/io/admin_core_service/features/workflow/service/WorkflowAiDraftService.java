package vacademy.io.admin_core_service.features.workflow.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.agent.dto.ConversationSession;
import vacademy.io.admin_core_service.features.agent.service.LLMService;
import vacademy.io.admin_core_service.features.workflow.controller.WorkflowAiCatalogController;
import vacademy.io.admin_core_service.features.workflow.dto.WorkflowAiDraftRequest;
import vacademy.io.admin_core_service.features.workflow.dto.WorkflowAiDraftResponse;
import vacademy.io.admin_core_service.features.workflow.dto.WorkflowBuilderDTO;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Template-first hybrid AI workflow drafter. Turns a natural-language goal into a
 * builder-shaped workflow draft that the admin reviews and publishes (never auto-activated).
 *
 * Flow (see WORKFLOW_AI_ASSIST_DESIGN.md §6): assemble the grounding pack from the AI catalog
 * → ask the LLM (via {@link LLMService}) to emit the workflow JSON → validate with
 * {@link WorkflowValidationService} → feed any errors back for a bounded repair loop → return
 * the draft plus rationale / clarifying questions / remaining validation errors.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WorkflowAiDraftService {

    private final WorkflowAiCatalogController aiCatalogController;
    private final LLMService llmService;
    private final WorkflowValidationService validationService;
    private final ObjectMapper objectMapper;

    // NB: the OpenRouter account behind LLMService does NOT expose the legacy
    // anthropic/claude-3.5-sonnet slug (404s). Default to a current, verified slug;
    // override via property. Requires openrouter.api.key to be set for admin_core.
    @Value("${workflow.ai.draft.model:anthropic/claude-sonnet-4.5}")
    private String draftModel;

    // Multi-step drafts (e.g. a 14-day drip = ~15 nodes + rationale) do not fit in the
    // LLMService default of 4096 completion tokens and would loop on finish_reason=length.
    @Value("${workflow.ai.draft.max-tokens:16000}")
    private int draftMaxTokens;

    /** Generate + validate attempts total (1 initial + N repairs). */
    private static final int MAX_ATTEMPTS = 3;

    // Per-institute drafting cap (sliding hour, per pod). Each draft is up to 3 large paid
    // completions; the membership check bounds WHO can call this but not HOW OFTEN.
    @Value("${workflow.ai.draft.rate-limit-per-hour:30}")
    private int rateLimitPerHour;

    private final ConcurrentHashMap<String, Deque<Long>> draftTimestampsByInstitute = new ConcurrentHashMap<>();

    private boolean rateLimitExceeded(String instituteId) {
        long now = System.currentTimeMillis();
        long windowStart = now - 3_600_000L;
        Deque<Long> stamps = draftTimestampsByInstitute.computeIfAbsent(instituteId, k -> new ArrayDeque<>());
        synchronized (stamps) {
            while (!stamps.isEmpty() && stamps.peekFirst() < windowStart) {
                stamps.pollFirst();
            }
            if (stamps.size() >= rateLimitPerHour) {
                return true;
            }
            stamps.addLast(now);
            return false;
        }
    }

    public WorkflowAiDraftResponse draft(WorkflowAiDraftRequest request, String userId) {
        if (request == null || request.getGoal() == null || request.getGoal().isBlank()) {
            return WorkflowAiDraftResponse.builder().error("A non-empty 'goal' is required.").build();
        }
        if (request.getInstituteId() == null || request.getInstituteId().isBlank()) {
            return WorkflowAiDraftResponse.builder().error("'instituteId' is required.").build();
        }
        if (rateLimitExceeded(request.getInstituteId())) {
            return WorkflowAiDraftResponse.builder()
                    .error("Too many AI drafts for this institute in the last hour — please try again later.")
                    .build();
        }

        final String grounding;
        try {
            grounding = objectMapper.writeValueAsString(aiCatalogController.getAiCatalog().getBody());
        } catch (Exception e) {
            log.error("[WorkflowAiDraft] Failed to build grounding pack", e);
            return WorkflowAiDraftResponse.builder().error("Failed to assemble catalog grounding.").build();
        }

        List<ConversationSession.ChatMessage> history = new ArrayList<>();
        history.add(ConversationSession.ChatMessage.system(systemPrompt(grounding)));
        history.add(ConversationSession.ChatMessage.user(userPrompt(request)));

        JsonNode root = null;
        WorkflowBuilderDTO workflow = null;
        List<WorkflowValidationService.ValidationError> errors = List.of();

        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            String raw;
            String finishReason = null;
            try {
                ConversationSession session = ConversationSession.builder()
                        .userId(userId)
                        .instituteId(request.getInstituteId())
                        .model(draftModel)
                        .maxTokens(draftMaxTokens)
                        .history(new ArrayList<>(history))
                        .build();
                LLMService.LLMResponse resp = llmService.generateChatCompletion(session);
                raw = resp != null ? resp.getContent() : null;
                finishReason = resp != null ? resp.getFinishReason() : null;
            } catch (Exception e) {
                log.error("[WorkflowAiDraft] LLM call failed on attempt {}", attempt, e);
                return WorkflowAiDraftResponse.builder()
                        .error("AI generation failed: " + safe(e.getMessage())).build();
            }
            if (raw == null || raw.isBlank()) {
                return WorkflowAiDraftResponse.builder().error("AI returned an empty response.").build();
            }
            // Truncated by the model's max_tokens — the JSON is almost certainly incomplete, so
            // don't try to parse it; ask for a more compact draft and retry.
            if ("length".equalsIgnoreCase(finishReason)) {
                if (attempt == MAX_ATTEMPTS) {
                    return WorkflowAiDraftResponse.builder()
                            .error("The workflow was too large to generate in one response. Try a simpler goal.").build();
                }
                history.add(ConversationSession.ChatMessage.assistant(raw));
                history.add(ConversationSession.ChatMessage.user(
                        "Your reply was cut off by the token limit. Produce a more COMPACT workflow: only essential nodes, short node names, no comments — and re-emit the full JSON contract."));
                continue;
            }

            String json = extractJson(raw);
            try {
                root = objectMapper.readTree(json);
            } catch (Exception e) {
                // Ask the model to re-emit strict JSON.
                history.add(ConversationSession.ChatMessage.assistant(raw));
                history.add(ConversationSession.ChatMessage.user(
                        "Your previous message was not valid JSON. Reply with ONLY the JSON object described in the contract — no prose, no markdown fences."));
                continue;
            }

            // If the drafter needs entity resolution, return the questions immediately.
            List<Map<String, Object>> questions = toListOfMaps(root.get("clarifyingQuestions"));
            JsonNode wfNode = root.get("workflow");
            if (!questions.isEmpty() && (wfNode == null || wfNode.isNull())) {
                return WorkflowAiDraftResponse.builder()
                        .clarifyingQuestions(questions)
                        .rationale(toListOfMaps(root.get("rationale")))
                        .templateUsed(asText(root.get("templateUsed")))
                        .warnings(new ArrayList<>())
                        .build();
            }

            if (wfNode == null || wfNode.isNull()) {
                history.add(ConversationSession.ChatMessage.assistant(raw));
                history.add(ConversationSession.ChatMessage.user(
                        "Your JSON is missing the 'workflow' object. Emit the full contract including 'workflow'."));
                continue;
            }

            try {
                workflow = objectMapper.treeToValue(wfNode, WorkflowBuilderDTO.class);
            } catch (Exception e) {
                history.add(ConversationSession.ChatMessage.assistant(raw));
                history.add(ConversationSession.ChatMessage.user(
                        "The 'workflow' object did not match the required shape (" + safe(e.getMessage())
                                + "). Fix it and re-emit the full JSON contract."));
                continue;
            }

            // Force safe defaults regardless of what the model emitted.
            workflow.setId(null); // never trust a model-invented workflow id — create flow assigns it
            workflow.setInstituteId(request.getInstituteId());
            workflow.setStatus("DRAFT");

            errors = safeValidate(workflow);
            if (errors.isEmpty() || attempt == MAX_ATTEMPTS) {
                break;
            }

            // Repair: hand the model its own draft + the validation errors.
            String errText;
            try {
                errText = objectMapper.writeValueAsString(errors);
            } catch (Exception e) {
                errText = String.valueOf(errors);
            }
            history.add(ConversationSession.ChatMessage.assistant(raw));
            history.add(ConversationSession.ChatMessage.user(
                    "The workflow failed validation with these errors: " + errText
                            + "\nFix them and re-emit the FULL JSON contract (workflow + rationale)."));
        }

        if (workflow == null) {
            return WorkflowAiDraftResponse.builder()
                    .error("Could not produce a valid workflow after " + MAX_ATTEMPTS + " attempts.")
                    .build();
        }

        return WorkflowAiDraftResponse.builder()
                .workflow(workflow)
                .rationale(toListOfMaps(root != null ? root.get("rationale") : null))
                .clarifyingQuestions(toListOfMaps(root != null ? root.get("clarifyingQuestions") : null))
                .templateUsed(asText(root != null ? root.get("templateUsed") : null))
                .validationErrors(errors)
                .warnings(collectWarnings(root))
                .build();
    }

    // ---- prompts ---------------------------------------------------------

    private String systemPrompt(String groundingJson) {
        return """
            You are the Vacademy workflow drafter. You turn an admin's natural-language automation \
            goal into ONE workflow JSON that loads into the visual builder for the admin to review \
            and publish. You never activate anything — you only draft.

            APPROACH (template-first hybrid): if the goal maps cleanly onto a common pattern \
            (lead follow-up, welcome email, attendance report, session reminder, abandoned-cart \
            nudge, fee reminder, drip/trial nurture sequence), build that pattern with the right \
            trigger + query + send nodes. Only compose novel node graphs when no common pattern fits.

            DRIP / TRIAL SEQUENCES: a multi-day message sequence is ONE event-driven workflow — \
            a chain of DELAY -> SEND_WHATSAPP (or SEND_EMAIL) pairs, never one workflow per day \
            and never a LOOP node. Long DELAYs persist and survive restarts. If the sequence must \
            start on a fixed weekday regardless of signup day (e.g. "trial starts next Monday"), \
            make the FIRST node after the trigger a DELAY with \
            {"delay":{"until":"NEXT_DAY_OF_WEEK","dayOfWeek":"MONDAY","time":"09:00","timezone":"Asia/Kolkata"}} \
            and use fixed {"delay":{"value":N,"unit":"DAYS"}} between the subsequent sends. For a \
            single enrolled learner from the trigger context, send with on = "{#ctx['user']}" and \
            recipient fields from the UserDTO (email, mobileNumber, fullName). Dedup: set \
            trigger.idempotency_generation_setting to a CUSTOM_EXPRESSION that includes the PERSON, \
            e.g. {"strategy":"CUSTOM_EXPRESSION","customExpression":"'wf_' + #ctx['triggerId'] + '_' + #ctx['eventId'] + '_' + #ctx['user']['id']"} \
            so a duplicate/retried enrollment event cannot start a second drip for the same learner. \
            NEVER use EVENT_BASED for enrollment events — its key has no learner in it, so it would \
            let only the FIRST learner of the batch ever enter the workflow.

            You are given a CATALOG (below) of node types, read queries with their exact output \
            field names, common triggers, and a set of GENERATION RULES. Obey every rule in \
            catalog.generationRules. Never use a node in catalog.avoidNodeTypes. Never put a \
            catalog.mutatingQueryKeys query in the workflow. Reference query outputs by their real \
            keys/fields from catalog.readQueries — field-name casing matters.

            ENTITY IDS: never invent an audienceId, batchId, inviteId, or templateName. If the goal \
            needs one you were not given (see the user's provided answers), return it as a \
            clarifyingQuestions entry instead and leave workflow null.

            OUTPUT: reply with ONLY a JSON object (no markdown, no prose) of this exact shape:
            {
              "workflow": { ...builder workflow JSON per catalog.workflowJsonShape, or null if you need answers... },
              "rationale": [ { "nodeId": "...", "explains": "one plain-English sentence" } ],
              "clarifyingQuestions": [ { "id": "audienceId", "question": "Which audience?", "entityType": "AUDIENCE" } ],
              "templateUsed": "short pattern name or null"
            }

            CATALOG:
            """ + groundingJson;
    }

    private String userPrompt(WorkflowAiDraftRequest request) {
        StringBuilder sb = new StringBuilder();
        sb.append("Institute ID: ").append(request.getInstituteId()).append('\n');
        sb.append("Goal: ").append(request.getGoal().trim()).append('\n');
        if (request.getAnswers() != null && !request.getAnswers().isEmpty()) {
            try {
                sb.append("Previously answered (use these, do not re-ask): ")
                        .append(objectMapper.writeValueAsString(request.getAnswers()));
            } catch (Exception ignored) {
                sb.append("Previously answered: ").append(request.getAnswers());
            }
        }
        return sb.toString();
    }

    // ---- helpers ---------------------------------------------------------

    private List<WorkflowValidationService.ValidationError> safeValidate(WorkflowBuilderDTO dto) {
        try {
            List<WorkflowValidationService.ValidationError> e = validationService.validate(dto);
            return e != null ? e : List.of();
        } catch (Exception ex) {
            // Fail closed: a validator that throws must NOT make a broken draft look clean.
            log.warn("[WorkflowAiDraft] Validation threw: {}", ex.getMessage());
            return List.of(new WorkflowValidationService.ValidationError(
                    null, "workflow", "Draft could not be validated: " + safe(ex.getMessage()), "ERROR"));
        }
    }

    /** Surface non-blocking cautions for triggers with known semantic quirks. */
    private List<String> collectWarnings(JsonNode root) {
        List<String> warnings = new ArrayList<>();
        if (root == null) return warnings;
        String wf = root.has("workflow") ? root.get("workflow").toString() : "";
        if (wf.contains("INVITE_FORM_FILL")) {
            warnings.add("INVITE_FORM_FILL fires when the invite page is VIEWED, not when the form is submitted.");
        }
        if (wf.contains("LIVE_SESSION_START") || wf.contains("LIVE_SESSION_END")) {
            warnings.add("LIVE_SESSION_START/END fire from a 5-minute periodic scan, so timing is approximate.");
        }
        return warnings;
    }

    /** Pull the JSON object out of a possibly fenced / prose-wrapped LLM reply. */
    private String extractJson(String raw) {
        String s = raw.trim();
        int fence = s.indexOf("```");
        if (fence >= 0) {
            int nl = s.indexOf('\n', fence);
            int close = s.indexOf("```", fence + 3);
            if (nl >= 0 && close > nl) {
                s = s.substring(nl + 1, close).trim();
            }
        }
        int open = s.indexOf('{');
        int last = s.lastIndexOf('}');
        if (open >= 0 && last > open) {
            return s.substring(open, last + 1);
        }
        return s;
    }

    private List<Map<String, Object>> toListOfMaps(JsonNode node) {
        List<Map<String, Object>> out = new ArrayList<>();
        if (node == null || !node.isArray()) return out;
        for (JsonNode el : node) {
            try {
                @SuppressWarnings("unchecked")
                Map<String, Object> m = objectMapper.convertValue(el, Map.class);
                if (m != null) out.add(m);
            } catch (Exception ignored) {
                // skip malformed entries
            }
        }
        return out;
    }

    private String asText(JsonNode node) {
        return node == null || node.isNull() ? null : node.asText();
    }

    private String safe(String s) {
        return s == null ? "" : s;
    }
}
