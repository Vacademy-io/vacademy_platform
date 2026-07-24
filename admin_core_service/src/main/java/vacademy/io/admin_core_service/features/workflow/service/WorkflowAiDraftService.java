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
import vacademy.io.admin_core_service.features.workflow.dto.WorkflowDecisionDTO;
import vacademy.io.admin_core_service.features.workflow.dto.WorkflowPlanDTO;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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

    /** Generate + validate attempts total (1 initial + N repairs). */
    private static final int MAX_ATTEMPTS = 3;

    public WorkflowAiDraftResponse draft(WorkflowAiDraftRequest request, String userId) {
        if (request == null || request.getInstituteId() == null || request.getInstituteId().isBlank()) {
            return WorkflowAiDraftResponse.builder().error("'instituteId' is required.").build();
        }
        String mode = request.getMode();
        // BUILD: deterministic assembly from the confirmed skeleton + answers — no LLM, no goal needed.
        if ("BUILD".equalsIgnoreCase(mode)) {
            return buildFromDecisions(request);
        }
        if (request.getGoal() == null || request.getGoal().isBlank()) {
            return WorkflowAiDraftResponse.builder().error("A non-empty 'goal' is required.").build();
        }
        // PLAN: propose a skeleton + the decisions the admin must make (assistive path).
        if ("PLAN".equalsIgnoreCase(mode)) {
            return planWorkflow(request, userId);
        }
        // else: legacy single-shot draft (backward compatible).

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

    // ---- PLAN: propose a skeleton + the decisions the admin must make --------

    private WorkflowAiDraftResponse planWorkflow(WorkflowAiDraftRequest request, String userId) {
        final String grounding;
        try {
            grounding = objectMapper.writeValueAsString(aiCatalogController.getAiCatalog().getBody());
        } catch (Exception e) {
            log.error("[WorkflowAiDraft] PLAN grounding failed", e);
            return WorkflowAiDraftResponse.builder().error("Failed to assemble catalog grounding.").build();
        }
        List<ConversationSession.ChatMessage> history = new ArrayList<>();
        history.add(ConversationSession.ChatMessage.system(planSystemPrompt(grounding)));
        history.add(ConversationSession.ChatMessage.user(userPrompt(request)));

        JsonNode root = null;
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            String raw;
            String finishReason = null;
            try {
                ConversationSession session = ConversationSession.builder()
                        .userId(userId)
                        .instituteId(request.getInstituteId())
                        .model(draftModel)
                        .history(new ArrayList<>(history))
                        .build();
                LLMService.LLMResponse resp = llmService.generateChatCompletion(session);
                raw = resp != null ? resp.getContent() : null;
                finishReason = resp != null ? resp.getFinishReason() : null;
            } catch (Exception e) {
                log.error("[WorkflowAiDraft] PLAN LLM call failed on attempt {}", attempt, e);
                return WorkflowAiDraftResponse.builder().error("AI planning failed: " + safe(e.getMessage())).build();
            }
            if (raw == null || raw.isBlank()) {
                return WorkflowAiDraftResponse.builder().error("AI returned an empty response.").build();
            }
            if ("length".equalsIgnoreCase(finishReason)) {
                if (attempt == MAX_ATTEMPTS) {
                    return WorkflowAiDraftResponse.builder().error("The plan was too large. Try a simpler goal.").build();
                }
                history.add(ConversationSession.ChatMessage.assistant(raw));
                history.add(ConversationSession.ChatMessage.user(
                        "Your reply was cut off by the token limit. Produce a more COMPACT plan (fewer steps, short names) and re-emit the full JSON contract."));
                continue;
            }
            try {
                root = objectMapper.readTree(extractJson(raw));
                break;
            } catch (Exception e) {
                if (attempt == MAX_ATTEMPTS) {
                    return WorkflowAiDraftResponse.builder().error("AI plan was not valid JSON.").build();
                }
                history.add(ConversationSession.ChatMessage.assistant(raw));
                history.add(ConversationSession.ChatMessage.user(
                        "Your previous message was not valid JSON. Reply with ONLY the JSON object described in the contract."));
            }
        }
        if (root == null) {
            return WorkflowAiDraftResponse.builder().error("Could not produce a plan.").build();
        }

        WorkflowPlanDTO plan = null;
        try {
            if (root.hasNonNull("plan")) plan = objectMapper.treeToValue(root.get("plan"), WorkflowPlanDTO.class);
        } catch (Exception e) {
            log.warn("[WorkflowAiDraft] PLAN plan parse failed: {}", e.getMessage());
        }
        List<WorkflowDecisionDTO> decisions = new ArrayList<>();
        JsonNode dNode = root.get("decisions");
        if (dNode != null && dNode.isArray()) {
            for (JsonNode d : dNode) {
                try { decisions.add(objectMapper.treeToValue(d, WorkflowDecisionDTO.class)); }
                catch (Exception ignored) { /* skip malformed decision */ }
            }
        }
        WorkflowBuilderDTO skeleton = null;
        try {
            JsonNode skNode = root.get("skeleton");
            if (skNode != null && !skNode.isNull()) {
                skeleton = objectMapper.treeToValue(skNode, WorkflowBuilderDTO.class);
                skeleton.setId(null);
                skeleton.setInstituteId(request.getInstituteId());
                skeleton.setStatus("DRAFT");
            }
        } catch (Exception e) {
            log.warn("[WorkflowAiDraft] PLAN skeleton parse failed: {}", e.getMessage());
        }
        // Defensively clear any decision-target the model left filled — the skeleton the admin
        // sees must never carry an AI-invented template/entity id; those come only from answers.
        if (skeleton != null) stripDecisionTargets(skeleton, decisions);
        if (plan == null && skeleton == null) {
            return WorkflowAiDraftResponse.builder().error("The AI did not return a usable plan.").build();
        }
        return WorkflowAiDraftResponse.builder()
                .turnType("PLAN_PROPOSAL")
                .plan(plan)
                .decisions(decisions)
                .skeleton(skeleton)
                .templateUsed(asText(root.get("templateUsed")))
                .warnings(collectWarnings(root))
                .build();
    }

    // ---- BUILD: deterministic assembly from confirmed skeleton + answers -----

    @SuppressWarnings("unchecked")
    private WorkflowAiDraftResponse buildFromDecisions(WorkflowAiDraftRequest request) {
        WorkflowBuilderDTO wf = request.getSkeleton();
        if (wf == null) {
            return WorkflowAiDraftResponse.builder()
                    .error("BUILD requires the 'skeleton' returned by the PLAN turn.").build();
        }
        List<WorkflowDecisionDTO> decisions = request.getDecisions() != null ? request.getDecisions() : List.of();
        Map<String, Object> answered = new HashMap<>();
        if (request.getDecisionAnswers() != null) {
            for (WorkflowAiDraftRequest.DecisionAnswer a : request.getDecisionAnswers()) {
                if (a != null && a.getId() != null) answered.put(a.getId(), a.getValue());
            }
        }
        List<String> unresolvedRequired = new ArrayList<>();
        for (WorkflowDecisionDTO d : decisions) {
            if (d == null || d.getId() == null) continue;
            Object val = answered.get(d.getId());
            boolean blank = val == null
                    || (val instanceof String && ((String) val).isBlank())
                    || (val instanceof List && ((List<Object>) val).isEmpty())
                    || (val instanceof Map && ((Map<Object, Object>) val).isEmpty());
            if (blank) {
                if (d.isRequired()) unresolvedRequired.add(d.getId());
                continue;
            }
            try {
                applyDecision(wf, d, val);
            } catch (Exception e) {
                log.warn("[WorkflowAiDraft] Failed to apply decision {}: {}", d.getId(), e.getMessage());
            }
        }
        wf.setId(null);
        wf.setInstituteId(request.getInstituteId());
        wf.setStatus("DRAFT");

        List<WorkflowValidationService.ValidationError> errors = safeValidate(wf);
        List<String> warnings = new ArrayList<>();
        if (!unresolvedRequired.isEmpty()) {
            warnings.add("Unanswered required decisions (fill these in the builder before publishing): "
                    + String.join(", ", unresolvedRequired));
        }
        return WorkflowAiDraftResponse.builder()
                .turnType("FINAL_WORKFLOW")
                .workflow(wf)
                .validationErrors(errors)
                .warnings(warnings)
                .build();
    }

    /** Write a decision's answer onto the skeleton at (nodeId, field dot-path). */
    @SuppressWarnings("unchecked")
    private void applyDecision(WorkflowBuilderDTO wf, WorkflowDecisionDTO d, Object value) {
        String field = d.getField();
        if (field == null || field.isBlank()) return;
        if (field.startsWith("trigger.")) {
            if (wf.getTrigger() == null) return;
            String sub = field.substring("trigger.".length());
            if ("event_ids".equals(sub) || "eventIds".equals(sub)) {
                wf.getTrigger().setEventIds(toStringList(value));
            } else if ("event_id".equals(sub) || "eventId".equals(sub)) {
                wf.getTrigger().setEventId(value == null ? null : String.valueOf(value));
            }
            return;
        }
        if (field.startsWith("config.")) {
            Map<String, Object> cfg = nodeConfig(wf, d.getNodeId());
            if (cfg == null) return;
            String sub = field.substring("config.".length());
            if (sub.startsWith("params.")) {
                String p = sub.substring("params.".length());
                Object paramsObj = cfg.get("params");
                Map<String, Object> params = (paramsObj instanceof Map) ? (Map<String, Object>) paramsObj : new LinkedHashMap<>();
                params.put(p, value);
                cfg.put("params", params);
            } else {
                cfg.put(sub, value);
            }
        }
    }

    /** Locate a node's config map by id, creating an empty one if absent. */
    @SuppressWarnings("unchecked")
    private Map<String, Object> nodeConfig(WorkflowBuilderDTO wf, String nodeId) {
        if (wf.getNodes() == null || nodeId == null) return null;
        for (WorkflowBuilderDTO.NodeDTO n : wf.getNodes()) {
            if (nodeId.equals(n.getId())) {
                Object cfg = n.getConfig();
                if (cfg instanceof Map) return (Map<String, Object>) cfg;
                Map<String, Object> m = new LinkedHashMap<>();
                n.setConfig(m);
                return m;
            }
        }
        return null;
    }

    /** Remove every decision-target field from the skeleton so it carries no AI-invented values. */
    @SuppressWarnings("unchecked")
    private void stripDecisionTargets(WorkflowBuilderDTO wf, List<WorkflowDecisionDTO> decisions) {
        if (decisions == null) return;
        for (WorkflowDecisionDTO d : decisions) {
            if (d == null || d.getField() == null) continue;
            String field = d.getField();
            if (field.startsWith("trigger.")) {
                if (wf.getTrigger() != null && field.substring("trigger.".length()).startsWith("event_id")) {
                    wf.getTrigger().setEventIds(null);
                    wf.getTrigger().setEventId(null);
                }
            } else if (field.startsWith("config.")) {
                Map<String, Object> cfg = nodeConfig(wf, d.getNodeId());
                if (cfg == null) continue;
                String sub = field.substring("config.".length());
                if (sub.startsWith("params.")) {
                    Object po = cfg.get("params");
                    if (po instanceof Map) ((Map<String, Object>) po).remove(sub.substring("params.".length()));
                } else {
                    cfg.remove(sub);
                }
            }
        }
    }

    private List<String> toStringList(Object value) {
        List<String> out = new ArrayList<>();
        if (value instanceof List) {
            for (Object o : (List<?>) value) if (o != null) out.add(String.valueOf(o));
        } else if (value instanceof String) {
            for (String s : ((String) value).split(",")) if (!s.isBlank()) out.add(s.trim());
        }
        return out;
    }

    // ---- prompts ---------------------------------------------------------

    private String systemPrompt(String groundingJson) {
        return """
            You are the Vacademy workflow drafter. You turn an admin's natural-language automation \
            goal into ONE workflow JSON that loads into the visual builder for the admin to review \
            and publish. You never activate anything — you only draft.

            APPROACH (template-first hybrid): if the goal maps cleanly onto a common pattern \
            (lead follow-up, welcome email, attendance report, session reminder, abandoned-cart \
            nudge, fee reminder), build that pattern with the right trigger + query + send nodes. \
            Only compose novel node graphs when no common pattern fits.

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

    private String planSystemPrompt(String groundingJson) {
        return """
            You are the Vacademy workflow drafter in ASSISTIVE PLAN mode. Instead of dumping a \
            finished workflow, you propose a plan and ask the admin to make the choices only a \
            human can make (which template, which audience/batch, how to map template variables). \
            You never activate anything.

            APPROACH (template-first hybrid): map the goal onto a common pattern when possible. Obey \
            every rule in catalog.generationRules. Never use catalog.avoidNodeTypes or \
            catalog.mutatingQueryKeys. Reference query outputs by their real keys/fields from \
            catalog.readQueries — casing matters.

            Produce THREE things: a human-readable PLAN, a list of DECISIONS the admin must make, \
            and a SKELETON workflow. In the skeleton, LEAVE OUT every value that is a decision \
            (templateName, template variable maps, and entity ids like audienceId/batchId/ \
            packageSessionIds and the trigger's event_ids) — those are elicited, never invented. \
            DO fill in values you can safely infer: node graph + edges, trigger_event_name, \
            workflow_type, DELAY config.delay.{value,unit}, and CONDITION predicates (the admin \
            can tweak delays/conditions on the canvas afterward).

            DECISION KINDS (Phase A — use ONLY these):
            - ENTITY_PICKER  → field "trigger.event_ids" (multi=true) for the trigger scope, or \
              "config.params.audienceId" / "config.params.batchId" / "config.params.packageSessionIds" \
              for a QUERY node. optionSource {"hook":"EventEntityPicker","args":{"eventAppliedType":"AUDIENCE|PACKAGE_SESSION|LIVE_SESSION|ENROLL_INVITE"}}. \
              Support multiple selections when the goal implies more than one (multi=true).
            - EMAIL_TEMPLATE     → field "config.templateName". optionSource {"hook":"getTemplatesByType","args":{"type":"EMAIL"}}.
            - WHATSAPP_TEMPLATE  → field "config.templateName". optionSource {"hook":"getTemplatesByType","args":{"type":"WHATSAPP"}}.
            - TEMPLATE_VAR_MAP   → field "config.templateVars". No optionSource (the UI derives the \
              placeholders from the chosen template). Set dependsOn:[<the template decision id>]. \
              Add ONE of these per SEND_EMAIL/SEND_WHATSAPP node that uses a template.

            Every decision's nodeId MUST match a node id in the skeleton (except trigger-scoped \
            decisions, whose field starts with "trigger."). Batch ALL decisions the plan needs into \
            the single "decisions" array.

            OUTPUT: reply with ONLY this JSON object (no markdown, no prose):
            {
              "plan": {
                "summary": "one line",
                "workflowType": "EVENT_DRIVEN | SCHEDULED",
                "templateUsed": "pattern name or null",
                "steps": [ { "stepId": "s1", "nodeType": "TRIGGER", "title": "...", "detail": "...", "openDecisions": ["d_audience"] } ],
                "warnings": []
              },
              "decisions": [
                { "id": "d_audience", "kind": "ENTITY_PICKER", "prompt": "Which audience?", "stepId": "s1", "nodeId": null, "field": "trigger.event_ids", "multi": true, "required": true,
                  "optionSource": {"hook":"EventEntityPicker","args":{"eventAppliedType":"AUDIENCE"}} },
                { "id": "d_wa_tmpl", "kind": "WHATSAPP_TEMPLATE", "prompt": "Which WhatsApp template?", "stepId": "s4", "nodeId": "n_wa", "field": "config.templateName", "multi": false, "required": true,
                  "optionSource": {"hook":"getTemplatesByType","args":{"type":"WHATSAPP"}} },
                { "id": "d_wa_vars", "kind": "TEMPLATE_VAR_MAP", "prompt": "Map the template placeholders", "stepId": "s4", "nodeId": "n_wa", "field": "config.templateVars", "multi": false, "required": true, "dependsOn": ["d_wa_tmpl"] }
              ],
              "skeleton": { ...builder workflow JSON per catalog.workflowJsonShape, with the decision fields OMITTED... },
              "templateUsed": "pattern name or null"
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
        String wf = (root.has("workflow") ? root.get("workflow").toString() : "")
                + (root.has("skeleton") ? root.get("skeleton").toString() : "");
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
