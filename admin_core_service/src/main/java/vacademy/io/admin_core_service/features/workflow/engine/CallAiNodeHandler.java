package vacademy.io.admin_core_service.features.workflow.engine;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.audience.entity.UserLeadProfile;
import vacademy.io.admin_core_service.features.audience.repository.UserLeadProfileRepository;
import vacademy.io.admin_core_service.features.telephony.core.AiCallNodeDispatcher;
import vacademy.io.admin_core_service.features.telephony.core.AiCallOutcomeProcessor;
import vacademy.io.admin_core_service.features.telephony.core.AiCallingSettingsService;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiCallRequestDTO;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiCallingSettingsPojo;
import vacademy.io.admin_core_service.features.workflow.entity.NodeTemplate;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowExecutionState;
import vacademy.io.admin_core_service.features.workflow.enums.WorkflowExecutionStatus;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowExecutionRepository;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowExecutionStateRepository;
import vacademy.io.admin_core_service.features.workflow.spel.SpelEvaluator;

import java.time.Instant;
import java.util.Collection;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * CALL_AI workflow node — a re-entrant, phase-routed AI caller that IS the retry
 * loop. On each (re)entry it decides what to do for the lead from the institute's
 * AI_CALLING_SETTING (caps + shifts + timings), then:
 *   DIAL  → enqueue one paced AI call, bump the attempt counters, and PAUSE the
 *           workflow (persist {@code workflow_execution_state}) until the next window;
 *   DEFER → PAUSE for a re-check (outside the calling shifts / hit the per-day cap);
 *   STOP  → complete (lead assigned, out of retries, or AI calling off).
 *
 * <p>The retry state (attempt counts) lives in the paused execution's serialized
 * context — the general workflow pause/resume table, not a telephony table. When the
 * end-of-call outcome is terminal (assigned / not-interested), AiCallOutcomeProcessor
 * cancels the paused state so the loop stops early. The same node serves the
 * first call and every retry — one node, no separate re-dialer.
 */
@Component
@RequiredArgsConstructor
public class CallAiNodeHandler implements NodeHandler {

    private static final Logger log = LoggerFactory.getLogger(CallAiNodeHandler.class);
    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    private final AiCallNodeDispatcher aiCallDispatcher;
    private final AiCallingSettingsService settingsService;
    private final UserLeadProfileRepository userLeadProfileRepository;
    private final WorkflowExecutionStateRepository executionStateRepository;
    private final WorkflowExecutionRepository executionRepository;
    private final SpelEvaluator spelEvaluator;
    private final ObjectMapper mapper = new ObjectMapper();

    /**
     * Field-injected with {@code @Lazy} to break an init-time bean cycle:
     * CALL_AI → AiCallOutcomeProcessor → LeadStatusService → WorkflowTriggerService →
     * WorkflowEngineService → NodeHandlerRegistry → CALL_AI. It's only used at runtime
     * on the exhausted-retry handoff, so a lazily-resolved proxy is correct.
     */
    @Autowired
    @Lazy
    private AiCallOutcomeProcessor aiCallOutcomeProcessor;

    @Override
    public boolean supports(String nodeType) {
        return "CALL_AI".equalsIgnoreCase(nodeType);
    }

    @Override
    public Map<String, Object> handle(Map<String, Object> context, String nodeConfigJson,
                                      Map<String, NodeTemplate> nodeTemplates, int countProcessed) {
        Map<String, Object> out = new HashMap<>();

        // Cohort (forEach) mode: when the node config carries a "forEach" block, iterate a
        // source list from context (e.g. a QUERY node's ssigm_list) and enqueue one paced AI
        // call per item — a provider-agnostic broadcast. Distinct from the single-subject
        // retry flow below (which runs whenever there is no forEach). No per-item pause/retry.
        JsonNode forEach = readConfigNode(nodeConfigJson, "forEach");
        if (forEach != null && forEach.isObject()) {
            return handleCohort(context, nodeConfigJson, forEach, out);
        }

        String instituteId = str(context.get("instituteId"));
        String userId = firstNonBlank(str(context.get("leadUserId")), str(context.get("userId")));
        String phone = firstNonBlank(str(context.get("phone")), str(context.get("parentMobile")));
        // The lead id (audience_response.id). NOTE: "eventId" is the AUDIENCE id, not
        // the lead, so it is deliberately NOT a fallback.
        String responseId = firstNonBlank(str(context.get("responseId")), str(context.get("leadId")));
        // Campaign: prefer a provider-agnostic agent NAME (resolved per-provider from the
        // campaigns registry downstream); a raw campaignId still works as an override.
        String campaignName = firstNonBlank(readConfig(nodeConfigJson, "campaignName"), str(context.get("campaignName")));
        String campaignId = firstNonBlank(readConfig(nodeConfigJson, "campaignId"), str(context.get("campaignId")));
        // Subject envelope: who we're calling. Blank ⇒ LEAD with subjectId = the lead's
        // responseId, so existing lead workflows (which set neither) behave exactly as before.
        // PACKAGE_SESSION_STUDENT / LIVE_SESSION_PARTICIPANT set these in their initial context.
        String subjectType = firstNonBlank(str(context.get("subjectType")), "LEAD");
        String subjectId = firstNonBlank(str(context.get("subjectId")), responseId);
        // Provider per-node (node config wins, else workflow context, else AiCallService
        // falls back to the institute's AI_CALLING_SETTING default). Lets one builder pick
        // the provider for this node without touching global settings.
        String provider = firstNonBlank(readConfig(nodeConfigJson, "provider"), str(context.get("provider")));
        // Arbitrary call metadata handed to the AI agent (e.g. studentName, sessionName,
        // courseName — whatever the conversation needs). Static keys come from the node
        // config's "metadata" object; dynamic per-run values from the context's
        // "aiCallMetadata" map (set by the trigger / an upstream node / the cohort scheduler).
        // This is what makes the node reusable for ANY purpose — it carries whatever the agent
        // needs, not a fixed lead/feedback shape. Round-trips on the webhook for correlation.
        Map<String, Object> callMetadata = new HashMap<>();
        Map<String, Object> cfgMeta = readConfigMap(nodeConfigJson, "metadata");
        if (cfgMeta != null) callMetadata.putAll(cfgMeta);
        if (context.get("aiCallMetadata") instanceof Map<?, ?> m) {
            m.forEach((k, v) -> callMetadata.put(String.valueOf(k), v));
        }

        int attempts = asInt(context.get("aiCallAttempts"));
        int callsToday = asInt(context.get("aiCallsToday"));
        String callsDay = str(context.get("aiCallDay"));

        // Cancel→resume bridge: the outcome processor resumed this paused state with a
        // terminal disposition injected (callOutcome). Short-circuit OUT of the node —
        // route to the next node via normal traversal — without re-dialing or pausing.
        // CONSUME the one-shot bridge keys immediately (remove from the live context) so
        // they can NEVER persist into a later pause/resume: otherwise a re-entry (a
        // downstream DELAY pause, or a graph that loops back to CALL_AI) would re-read the
        // stale callOutcome and short-circuit again with no new call — silently killing
        // the retry loop. remove() not null-put: a "null" round-trips to the String "null".
        String callOutcome = str(context.get("callOutcome"));
        context.remove("callOutcome");
        context.remove("callDisposition");
        context.remove("callConnected");
        if ("ASSIGN".equals(callOutcome) || "STOP".equals(callOutcome)) {
            out.put("aiCallDone", true);
            out.put("aiCallStopReason", "disposition_terminal");
            log.info("CALL_AI node: terminal disposition ({}) for lead {} — routing out without re-dial", callOutcome, userId);
            return out;   // routes to next node via normal traversal; does NOT pause/dial; does NOT call giveUpAfterRetries
        }

        Plan plan = plan(instituteId, userId, attempts, callsToday, callsDay);

        switch (plan.action()) {
            case STOP -> {
                log.info("CALL_AI node: stop ({}) for lead {} after {} attempt(s)", plan.reason(), userId, attempts);
                // Gave up after maxRetries with no pickup → LEAD terminal handoff
                // (assign-to-human per settings + stamp AI_NO_ANSWER). Lead-specific: a
                // non-lead subject just completes the node (the workflow continues with the
                // exhausted reason; no lead assignment / status).
                if ("exhausted".equals(plan.reason()) && "LEAD".equalsIgnoreCase(subjectType)) {
                    aiCallOutcomeProcessor.giveUpAfterRetries(responseId, instituteId, userId);
                }
                out.put("aiCallDone", true);
                out.put("aiCallStopReason", plan.reason());
            }
            case DEFER -> {
                pauseWorkflow(context, plan.resumeAt(), "AI_CALL_RECHECK", out);
                log.info("CALL_AI node: deferring ({}) lead {} until {}", plan.reason(), userId, plan.resumeAt());
            }
            case DIAL -> {
                AiCallRequestDTO req = new AiCallRequestDTO();
                req.setInstituteId(instituteId);
                req.setUserId(userId);
                req.setPhoneNumber(phone);
                req.setResponseId(responseId);
                req.setCampaignName(campaignName); // provider-agnostic agent; resolved downstream
                req.setCampaignId(campaignId);     // raw override (back-compat)
                req.setProvider(provider);         // null ⇒ AiCallService uses the settings default
                req.setSubjectType(subjectType);
                req.setSubjectId(subjectId);
                if (!callMetadata.isEmpty()) req.setMetadata(callMetadata);

                aiCallDispatcher.enqueue(req); // paced; placeCall guards already-assigned leads

                int newAttempts = attempts + 1;
                String today = LocalDate.now(IST).toString();
                int newCallsToday = today.equals(callsDay) ? callsToday + 1 : 1;

                Map<String, Object> pauseContext = new HashMap<>(context);
                pauseContext.put("aiCallAttempts", newAttempts);
                pauseContext.put("aiCallsToday", newCallsToday);
                pauseContext.put("aiCallDay", today);
                if (responseId != null) pauseContext.put("responseId", responseId); // lead resume lookup
                if (subjectId != null) pauseContext.put("subjectId", subjectId);     // generic subject resume lookup

                pauseWorkflow(pauseContext, plan.resumeAt(), "AI_CALL_RETRY", out);
                log.info("CALL_AI node: queued AI call for lead {} (attempt {}); pausing until {}",
                        userId, newAttempts, plan.resumeAt());
                out.put("aiCallQueued", true);
                out.put("aiCallAttempt", newAttempts);
            }
        }
        return out;
    }

    /** Persist a paused execution state and mark the execution PAUSED — the existing
     *  WorkflowResumeJob re-runs the workflow at {@code resumeAt}. */
    private void pauseWorkflow(Map<String, Object> context, Instant resumeAt, String reason, Map<String, Object> out) {
        String executionId = str(context.get("executionId"));
        if (executionId == null) {
            // No execution to pause (e.g. a manual/test invocation) — can't loop; just dialed once.
            log.warn("CALL_AI node: no executionId in context — cannot pause for retry");
            out.put("__workflow_paused", false);
            return;
        }
        String nodeId = firstNonBlank(str(context.get("currentNodeId")), "CALL_AI");

        WorkflowExecutionState state = WorkflowExecutionState.builder()
                .executionId(executionId)
                .pausedAtNodeId(nodeId)
                .serializedContext(new HashMap<>(context))
                .resumeAt(resumeAt)
                .pauseReason(reason)
                .status("WAITING")
                .build();
        executionStateRepository.save(state);

        executionRepository.findById(executionId).ifPresent(ex -> {
            ex.setStatus(WorkflowExecutionStatus.PAUSED);
            executionRepository.save(ex);
        });

        out.put("__workflow_paused", true);
        out.put("resumeAt", resumeAt.toString());
    }

    private String readConfig(String json, String key) {
        if (json == null || json.isBlank()) return null;
        try {
            JsonNode v = mapper.readTree(json).get(key);
            return v == null || v.isNull() ? null : v.asText();
        } catch (Exception e) {
            return null;
        }
    }

    /** Read a JSON object node from the node config as a Map (for the metadata bag). */
    @SuppressWarnings("unchecked")
    private Map<String, Object> readConfigMap(String json, String key) {
        if (json == null || json.isBlank()) return null;
        try {
            JsonNode v = mapper.readTree(json).get(key);
            if (v == null || !v.isObject()) return null;
            return mapper.convertValue(v, Map.class);
        } catch (Exception e) {
            return null;
        }
    }

    /** Read a raw JSON node from the node config (for nested config blocks like forEach). */
    private JsonNode readConfigNode(String json, String key) {
        if (json == null || json.isBlank()) return null;
        try {
            JsonNode v = mapper.readTree(json).get(key);
            return (v == null || v.isNull()) ? null : v;
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Cohort broadcast: enqueue one paced AI call per item in a source list (e.g. a QUERY
     * node's {@code ssigm_list}). Each item's fields map to the call — defaults match
     * fetch_ssigm_by_package (userId / mobileNumber / packageSessionId / fullName); override
     * via the forEach config. Fire-and-forget + paced (no per-item pause/retry); each call's
     * answers land on ai_call_result, subject-tagged. The node then completes so the workflow
     * continues to its next node. Provider-agnostic: agent name + provider come from node
     * config (or context), exactly like the single-subject path.
     *
     * Config shape:
     * {
     *   "forEach": { "source": "#ctx['ssigm_list']", "subjectType": "PACKAGE_SESSION_STUDENT",
     *                "userIdField": "userId", "phoneField": "mobileNumber",
     *                "subjectIdField": "packageSessionId", "nameField": "fullName" },
     *   "campaignName": "Class Feedback", "provider": "MOCK",
     *   "metadata": { "sessionName": "..." }
     * }
     */
    private Map<String, Object> handleCohort(Map<String, Object> context, String nodeConfigJson,
                                             JsonNode forEach, Map<String, Object> out) {
        String source = forEach.path("source").asText("");
        if (isBlank(source)) {
            out.put("aiCallCohortError", "forEach.source is required");
            return out;
        }
        Object listObj;
        try {
            listObj = spelEvaluator.evaluate(source, context);
        } catch (Exception e) {
            out.put("aiCallCohortError", "could not evaluate forEach.source: " + e.getMessage());
            return out;
        }
        if (!(listObj instanceof Collection)) {
            out.put("aiCallCohortError", "forEach.source did not resolve to a list");
            return out;
        }

        String instituteId = str(context.get("instituteId"));
        // Agent + provider — same resolution as the single-subject path (config wins, else context).
        String campaignName = firstNonBlank(readConfig(nodeConfigJson, "campaignName"), str(context.get("campaignName")));
        String campaignId = firstNonBlank(readConfig(nodeConfigJson, "campaignId"), str(context.get("campaignId")));
        String provider = firstNonBlank(readConfig(nodeConfigJson, "provider"), str(context.get("provider")));

        // Subject + per-item field mapping (defaults align with fetch_ssigm_by_package output).
        String subjectType = firstNonBlank(forEach.path("subjectType").asText(null), "PACKAGE_SESSION_STUDENT");
        String userIdField = forEach.path("userIdField").asText("userId");
        String phoneField = forEach.path("phoneField").asText("mobileNumber");
        String subjectIdField = forEach.path("subjectIdField").asText("packageSessionId");
        String nameField = forEach.path("nameField").asText("fullName");
        Map<String, Object> metaTemplate = readConfigMap(nodeConfigJson, "metadata");

        int queued = 0, skipped = 0;
        for (Object it : (Collection<?>) listObj) {
            if (!(it instanceof Map<?, ?> item)) { skipped++; continue; }
            String userId = str(item.get(userIdField));
            if (isBlank(userId)) { skipped++; continue; } // telephony_call_log.user_id is NOT NULL
            String phone = str(item.get(phoneField));
            String subjectId = firstNonBlank(str(item.get(subjectIdField)), str(context.get("subjectId")));
            String name = str(item.get(nameField));

            AiCallRequestDTO req = new AiCallRequestDTO();
            req.setInstituteId(instituteId);
            req.setUserId(userId);
            req.setPhoneNumber(phone);          // blank ⇒ AiCallService resolves from the user profile
            req.setProvider(provider);
            req.setCampaignName(campaignName);
            req.setCampaignId(campaignId);
            req.setSubjectType(subjectType);
            req.setSubjectId(subjectId);
            req.setCustomerName(name);

            Map<String, Object> meta = new HashMap<>();
            if (metaTemplate != null) meta.putAll(metaTemplate);
            if (name != null) meta.put("studentName", name);
            if (subjectId != null) meta.put("packageSessionId", subjectId);
            req.setMetadata(meta.isEmpty() ? null : meta);

            aiCallDispatcher.enqueue(req);      // paced, async; placeCall records + dials (or MOCKs)
            queued++;
        }

        out.put("aiCallCohortQueued", queued);
        out.put("aiCallCohortSkipped", skipped);
        out.put("aiCallDone", true);            // node completes; workflow continues to the next node
        log.info("CALL_AI cohort: source='{}' subjectType={} -> {} queued, {} skipped (agent='{}', provider='{}')",
                source, subjectType, queued, skipped, campaignName, provider);
        return out;
    }

    private int asInt(Object o) {
        if (o instanceof Number n) return n.intValue();
        if (o instanceof String s && !s.isBlank()) {
            try { return Integer.parseInt(s.trim()); } catch (NumberFormatException ignore) { /* fall through */ }
        }
        return 0;
    }

    private String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    private String firstNonBlank(String... vals) {
        for (String v : vals) {
            if (v != null && !v.isBlank() && !"null".equals(v)) return v;
        }
        return null;
    }

    // ── Retry decision ──────────────────────────────────────────────────────────
    // The node owns this: given the institute's AI_CALLING_SETTING + the lead's
    // counters, dial now (resume_at = now + retryGapMinutes), defer (recheck later),
    // or stop. Nothing here runs on a schedule — it just computes the next-run time
    // the resume job will honor. Everything is read from the settings; nothing hardcoded.

    private enum Action { DIAL, DEFER, STOP }

    /** {@code resumeAt} = next-run time after a DIAL (gap) or DEFER (recheck); null for STOP. */
    private record Plan(Action action, Instant resumeAt, String reason) {}

    private Plan plan(String instituteId, String userId, int attempts, int callsToday, String callsDay) {
        AiCallingSettingsPojo s = settingsService.get(instituteId);
        if (s == null || !s.isEnabled()) return new Plan(Action.STOP, null, "ai_calling_disabled");
        if (leadAlreadyAssigned(userId, instituteId)) return new Plan(Action.STOP, null, "assigned");
        if (attempts >= Math.max(1, s.getMaxRetries())) return new Plan(Action.STOP, null, "exhausted");

        ZoneId tz = resolveZone(s.getTimezone());
        Instant now = Instant.now();
        Instant recheck = now.plus(Math.max(1, s.getRecheckMinutes()), ChronoUnit.MINUTES);

        if (!withinAnyShift(now, s.getCallingShifts(), tz)) {
            // Outside the calling shift: don't poll every recheckMinutes all night.
            // Sleep until the NEXT shift-open instant (today if still ahead, else
            // the first shift tomorrow) so the lead only wakes when dialing is allowed.
            Instant nextOpen = nextShiftOpen(now, s.getCallingShifts(), tz);
            Instant resumeAt = nextOpen != null ? nextOpen : recheck;
            log.info("CALL_AI node: outside calling shift for lead {} — resuming at next shift-open {} (tz {}) instead of recheck +{}m",
                    userId, resumeAt, tz, Math.max(1, s.getRecheckMinutes()));
            return new Plan(Action.DEFER, resumeAt, "outside_shift");
        }
        LocalDate today = LocalDate.now(tz);
        int effectiveToday = today.toString().equals(callsDay) ? callsToday : 0;
        if (effectiveToday >= Math.max(1, s.getMaxCallsPerDayPerLead())) {
            return new Plan(Action.DEFER, recheck, "day_cap");
        }
        return new Plan(Action.DIAL, now.plus(Math.max(1, s.getRetryGapMinutes()), ChronoUnit.MINUTES), "dial");
    }

    private boolean leadAlreadyAssigned(String userId, String instituteId) {
        if (isBlank(userId) || isBlank(instituteId)) return false;
        return userLeadProfileRepository.findByUserIdAndInstituteId(userId, instituteId)
                .map(UserLeadProfile::getAssignedCounselorId)
                .filter(id -> id != null && !id.isBlank())
                .isPresent();
    }

    /** Inside any [start,end] shift (institute tz); handles windows wrapping midnight. */
    private boolean withinAnyShift(Instant now, List<AiCallingSettingsPojo.Shift> shifts, ZoneId tz) {
        if (shifts == null || shifts.isEmpty()) return true;
        LocalTime t = LocalTime.ofInstant(now, tz);
        for (AiCallingSettingsPojo.Shift sh : shifts) {
            LocalTime start = parseTime(sh.getStart());
            LocalTime end = parseTime(sh.getEnd());
            if (start == null || end == null) continue;
            if (start.equals(end)) return true; // 24h
            boolean within = start.isBefore(end)
                    ? (!t.isBefore(start) && !t.isAfter(end))
                    : (!t.isBefore(start) || !t.isAfter(end));
            if (within) return true;
        }
        return false;
    }

    /**
     * Earliest upcoming shift-open instant in the institute tz: the smallest shift
     * start that is still ahead of {@code now} today; if none remain today, the
     * smallest shift start tomorrow. Returns null if no usable shift starts (caller
     * falls back to the recheck time). Uses the same parse/tz helpers as
     * {@link #withinAnyShift}.
     */
    private Instant nextShiftOpen(Instant now, List<AiCallingSettingsPojo.Shift> shifts, ZoneId tz) {
        if (shifts == null || shifts.isEmpty()) return null;
        LocalDate today = LocalDate.now(tz);
        LocalTime nowT = LocalTime.ofInstant(now, tz);

        LocalTime earliestToday = null; // smallest start still ahead today
        LocalTime earliestOverall = null; // smallest start of the day (for tomorrow)
        for (AiCallingSettingsPojo.Shift sh : shifts) {
            LocalTime start = parseTime(sh.getStart());
            if (start == null) continue;
            if (earliestOverall == null || start.isBefore(earliestOverall)) earliestOverall = start;
            if (start.isAfter(nowT) && (earliestToday == null || start.isBefore(earliestToday))) {
                earliestToday = start;
            }
        }
        if (earliestToday != null) return today.atTime(earliestToday).atZone(tz).toInstant();
        if (earliestOverall != null) return today.plusDays(1).atTime(earliestOverall).atZone(tz).toInstant();
        return null;
    }

    private LocalTime parseTime(String hhmm) {
        if (isBlank(hhmm)) return null;
        try {
            return LocalTime.parse(hhmm.trim());
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private ZoneId resolveZone(String tz) {
        if (isBlank(tz)) return IST;
        try {
            return ZoneId.of(tz.trim());
        } catch (Exception e) {
            return IST;
        }
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
