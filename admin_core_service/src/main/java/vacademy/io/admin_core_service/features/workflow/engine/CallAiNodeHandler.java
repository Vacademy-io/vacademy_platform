package vacademy.io.admin_core_service.features.workflow.engine;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.telephony.core.AiCallNodeDispatcher;
import vacademy.io.admin_core_service.features.telephony.core.AiCallOutcomeProcessor;
import vacademy.io.admin_core_service.features.telephony.core.AiCallRetryPlanner;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiCallRequestDTO;
import vacademy.io.admin_core_service.features.workflow.entity.NodeTemplate;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowExecutionState;
import vacademy.io.admin_core_service.features.workflow.enums.WorkflowExecutionStatus;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowExecutionRepository;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowExecutionStateRepository;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.Map;

/**
 * CALL_AI workflow node — a re-entrant, phase-routed AI caller that IS the retry
 * loop. On each (re)entry it asks {@link AiCallRetryPlanner} what to do for the lead
 * (using the institute's AI_CALLING_SETTING caps + shifts), then:
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
    private final AiCallRetryPlanner retryPlanner;
    private final WorkflowExecutionStateRepository executionStateRepository;
    private final WorkflowExecutionRepository executionRepository;
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

        String instituteId = str(context.get("instituteId"));
        String userId = firstNonBlank(str(context.get("leadUserId")), str(context.get("userId")));
        String phone = firstNonBlank(str(context.get("phone")), str(context.get("parentMobile")));
        // The lead id (audience_response.id). NOTE: "eventId" is the AUDIENCE id, not
        // the lead, so it is deliberately NOT a fallback.
        String responseId = firstNonBlank(str(context.get("responseId")), str(context.get("leadId")));
        String campaignId = firstNonBlank(readConfig(nodeConfigJson, "campaignId"), str(context.get("campaignId")));

        int attempts = asInt(context.get("aiCallAttempts"));
        int callsToday = asInt(context.get("aiCallsToday"));
        String callsDay = str(context.get("aiCallDay"));

        AiCallRetryPlanner.Plan plan = retryPlanner.plan(instituteId, userId, attempts, callsToday, callsDay);

        switch (plan.action()) {
            case STOP -> {
                log.info("CALL_AI node: stop ({}) for lead {} after {} attempt(s)", plan.reason(), userId, attempts);
                // Gave up after maxRetries with no pickup → terminal handoff
                // (assign-to-human per settings + stamp AI_NO_ANSWER).
                if ("exhausted".equals(plan.reason())) {
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
                req.setCampaignId(campaignId);

                aiCallDispatcher.enqueue(req); // paced; placeCall guards already-assigned leads

                int newAttempts = attempts + 1;
                String today = LocalDate.now(IST).toString();
                int newCallsToday = today.equals(callsDay) ? callsToday + 1 : 1;

                Map<String, Object> pauseContext = new HashMap<>(context);
                pauseContext.put("aiCallAttempts", newAttempts);
                pauseContext.put("aiCallsToday", newCallsToday);
                pauseContext.put("aiCallDay", today);
                if (responseId != null) pauseContext.put("responseId", responseId); // for outcome cancel lookup

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
}
