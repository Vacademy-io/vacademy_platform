package vacademy.io.admin_core_service.features.telephony.core;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementAction;
import vacademy.io.admin_core_service.features.engagement.repository.EngagementActionRepository;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiCallActionRule;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.AiAgent;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Turns "the agent promised it on the call" into a real WhatsApp / email / meeting.
 *
 * <p>The agent already offers a quiz link, a brochure and an advisor call on nearly every
 * call and nothing is sent — call 6801357a was even dispositioned Quiz_Link_Sent with no
 * link sent. See docs/crm/AI_CALL_ACTIONS.md.
 *
 * <p>This class evaluates the agent's send_rules against the post-call analysis (or against
 * a single artefact key for a mid-call sentinel) and writes one engagement_action row per
 * matching rule. Dispatch, Meta template enforcement, credits and delivery tracking are the
 * engagement layer's job — see {@link AiCallEngagementProvisioner} for why we ride it and
 * how its LLM half is kept out.
 *
 * <h2>Two properties this class guarantees</h2>
 * <ul>
 *   <li><b>Nothing double-sends.</b> Every row carries source_ref = callLogId:ruleId under a
 *       partial unique index (V462). A re-delivered webhook, a replayed spooled report and a
 *       reconciliation pass all lose the insert race and are swallowed. The AI recording race
 *       and the CPO duplicate-plan bug are both precedents for why this is not optional.
 *   <li><b>Nothing here can fail a call outcome.</b> Every rule runs in its own try/catch
 *       inside a method that catches everything. A brochure is never worth losing a
 *       disposition, a counsellor assignment or a lead status over.
 * </ul>
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class AiCallActionService {

    /** Marks rows this feature created — the other half of the idempotency key. */
    public static final String SOURCE = "AI_CALL";

    public static final String TIMING_POST_CALL = "POST_CALL";
    public static final String TIMING_MID_CALL = "MID_CALL";
    public static final String ACTION_BOOK_MEETING = "BOOK_MEETING";

    private static final Set<String> SEND_ACTION_TYPES = Set.of("SHARE_LINK", "SEND_MESSAGE");
    private static final Set<String> CHANNELS = Set.of("WHATSAPP", "EMAIL");

    private final EngagementActionRepository actionRepository;
    private final AiCallEngagementProvisioner provisioner;
    private final ObjectMapper mapper = new ObjectMapper();

    /** Ops kill switch. Off = rules stay editable and are evaluated nowhere. */
    @Value("${telephony.ai.actions.enabled:true}")
    private boolean actionsEnabled;

    /**
     * SEND = the action dispatches itself; TASK = it lands in the copilot inbox for a human.
     *
     * <p>Default SEND, deliberately, and this is the one place it diverges from the
     * engagement engine's documented copilot default. The reasoning is not "autonomy is fine
     * now" — it is that these are different acts. The engine DRAFTS something nobody asked
     * for, so a human gates it. Here an admin wrote the rule, the agent made the offer out
     * loud, and the caller said yes; a task sitting in a queue does not honour "main abhi
     * bhej deti hoon". Set this to TASK per environment to watch a batch land first.
     */
    @Value("${telephony.ai.actions.mode:SEND}")
    private String actionMode;

    /** A promised send that has sat this long is stale — the reaper expires it unsent. */
    @Value("${telephony.ai.actions.expiry-hours:24}")
    private int expiryHours;

    // ── reading rules off an agent ───────────────────────────────────────────────

    /** Total: a malformed rules blob yields no rules, never an exception. */
    public List<AiCallActionRule> rulesOf(AiAgent agent) {
        if (agent == null || agent.getSendRules() == null || agent.getSendRules().isBlank()) {
            return List.of();
        }
        try {
            List<AiCallActionRule> parsed = mapper.readValue(
                    agent.getSendRules(), new TypeReference<List<AiCallActionRule>>() {});
            List<AiCallActionRule> out = new ArrayList<>();
            for (AiCallActionRule r : parsed) {
                if (r != null && !Boolean.FALSE.equals(r.getEnabled()) && isUsable(r)) out.add(r);
            }
            return out;
        } catch (Exception e) {
            log.warn("ai-call-actions: unreadable send_rules on agent {} — treating as none: {}",
                    agent.getId(), e.getMessage());
            return List.of();
        }
    }

    /**
     * A rule with no id, no action type or no predicate can never be executed safely: the id
     * IS half the idempotency key, and an empty predicate would fire on every call.
     */
    private boolean isUsable(AiCallActionRule r) {
        if (r.getId() == null || r.getId().isBlank()) return false;
        if (r.getActionType() == null || r.getActionType().isBlank()) return false;
        AiCallActionRule.When w = r.getWhen();
        return w != null && (notBlank(w.getDisposition()) || notBlank(w.getPromised())
                || Boolean.TRUE.equals(w.getMeetingRequested())
                || (w.getExtracted() != null && !w.getExtracted().isEmpty()));
    }

    /**
     * The artefact vocabulary published to the voice bot. The analyser may only fill
     * promisedSends from this list, and a mid-call sentinel may only name a key in it — the
     * same closed-vocabulary discipline the dispositions already use.
     *
     * @param timing null = every timing; otherwise POST_CALL or MID_CALL
     */
    public List<String> artefactKeys(AiAgent agent, String timing) {
        Set<String> keys = new LinkedHashSet<>();
        for (AiCallActionRule r : rulesOf(agent)) {
            if (timing != null && !timing.equalsIgnoreCase(timingOf(r))) continue;
            if (notBlank(r.getArtefact())) keys.add(r.getArtefact().trim());
        }
        return new ArrayList<>(keys);
    }

    /**
     * The offers the agent should make on the call, for the prompt builder.
     *
     * <p>Each entry is {key, ask, timing}. The bot turns MID_CALL entries into "ask this;
     * if they agree, append the marker" and POST_CALL entries into "ask this" alone — the
     * post-call analyser picks those up from the transcript, so they need no marker.
     *
     * <p>Only rules with an askLine appear: a rule with no question is one the admin wants
     * to fire on something the caller raises unprompted, and telling the model to offer it
     * anyway would put words in its mouth.
     */
    public List<Map<String, String>> offers(AiAgent agent) {
        List<Map<String, String>> out = new ArrayList<>();
        for (AiCallActionRule r : rulesOf(agent)) {
            if (!notBlank(r.getAskLine()) || !notBlank(r.getArtefact())) continue;
            Map<String, String> o = new HashMap<>();
            o.put("key", r.getArtefact().trim());
            o.put("ask", r.getAskLine().trim());
            o.put("timing", timingOf(r).toUpperCase(Locale.ROOT));
            out.add(o);
        }
        return out;
    }

    /** True when this agent books meetings through a rule, so the legacy auto-book stands down. */
    public boolean hasBookMeetingRule(AiAgent agent) {
        return rulesOf(agent).stream()
                .anyMatch(r -> ACTION_BOOK_MEETING.equalsIgnoreCase(r.getActionType()));
    }

    /**
     * Booking page a matching BOOK_MEETING rule wants, so one agent can route different
     * meeting types to different pages. Null = fall back to the agent's own page.
     */
    public String bookingPageOverride(AiAgent agent, JsonNode report, String disposition) {
        View v = viewOf(report, disposition);
        for (AiCallActionRule r : rulesOf(agent)) {
            if (!ACTION_BOOK_MEETING.equalsIgnoreCase(r.getActionType())) continue;
            if (!TIMING_POST_CALL.equalsIgnoreCase(timingOf(r))) continue;
            if (matches(r, v) && notBlank(r.getBookingPageId())) return r.getBookingPageId().trim();
        }
        return null;
    }

    // ── evaluation ───────────────────────────────────────────────────────────────

    /** What a rule is evaluated against. Built once per call, never mutated. */
    record View(String disposition, Set<String> promised, boolean meetingRequested,
                Map<String, String> extracted) {}

    /** Reads the analyser's own report body. Absent fields degrade to "no match", never throw. */
    View viewOf(JsonNode report, String disposition) {
        Set<String> promised = new HashSet<>();
        Map<String, String> extracted = new HashMap<>();
        boolean meeting = false;
        if (report != null) {
            JsonNode ps = report.path("promisedSends");
            if (ps.isArray()) {
                ps.forEach(n -> {
                    if (n != null && !n.isNull() && !n.asText().isBlank()) {
                        promised.add(n.asText().trim());
                    }
                });
            }
            meeting = report.path("meetingRequested").asBoolean(false);
            JsonNode qa = report.path("extractedQa");
            if (qa.isObject()) {
                qa.fields().forEachRemaining(e -> extracted.put(
                        e.getKey() == null ? "" : e.getKey().toLowerCase(Locale.ROOT),
                        e.getValue() == null || e.getValue().isNull() ? "" : e.getValue().asText("")));
            }
        }
        return new View(disposition == null ? "" : disposition, promised, meeting,
                Collections.unmodifiableMap(extracted));
    }

    /** PURE. Every non-null predicate member must hold (AND). */
    static boolean matches(AiCallActionRule rule, View v) {
        AiCallActionRule.When w = rule.getWhen();
        if (w == null) return false;
        if (notBlank(w.getDisposition())
                && !w.getDisposition().trim().equalsIgnoreCase(v.disposition())) {
            return false;
        }
        if (notBlank(w.getPromised()) && !v.promised().contains(w.getPromised().trim())) {
            return false;
        }
        if (Boolean.TRUE.equals(w.getMeetingRequested()) && !v.meetingRequested()) {
            return false;
        }
        if (w.getExtracted() != null) {
            for (Map.Entry<String, String> e : w.getExtracted().entrySet()) {
                String answer = v.extracted().get(
                        e.getKey() == null ? "" : e.getKey().toLowerCase(Locale.ROOT));
                String want = e.getValue();
                if (answer == null || answer.isBlank()) return false;
                if (notBlank(want) && !"present".equalsIgnoreCase(want.trim())
                        && !want.trim().equalsIgnoreCase(answer.trim())) {
                    return false;
                }
            }
        }
        return true;
    }

    // ── execution ────────────────────────────────────────────────────────────────

    /**
     * Post-call: evaluate every POST_CALL rule and create the actions that match.
     *
     * <p>BOOK_MEETING rules are NOT executed here. The outcome processor's existing
     * auto-book already validates the resolved time, rejects past times and runs after
     * commit; duplicating that would be a second copy destined to drift. A rule only
     * redirects which page it books on — see {@link #bookingPageOverride}.
     *
     * @return how many actions were created (0 on any failure — this never throws)
     */
    public int applyPostCall(AiAgent agent, String instituteId, String callLogId,
                             String userId, String responseId, JsonNode report,
                             String disposition, String leadName) {
        if (!actionsEnabled || agent == null || callLogId == null) return 0;
        try {
            List<AiCallActionRule> rules = rulesOf(agent);
            if (rules.isEmpty()) return 0;
            View v = viewOf(report, disposition);
            int made = 0;
            for (AiCallActionRule rule : rules) {
                if (!TIMING_POST_CALL.equalsIgnoreCase(timingOf(rule))) continue;
                if (ACTION_BOOK_MEETING.equalsIgnoreCase(rule.getActionType())) continue;
                if (!matches(rule, v)) continue;
                try {
                    if (create(rule, instituteId, callLogId, userId, responseId, leadName,
                               "Promised on the AI call and accepted by the caller")) {
                        made++;
                    }
                } catch (Exception one) {
                    log.warn("ai-call-actions: rule {} on agent {} failed for call {}: {}",
                            rule.getId(), agent.getId(), callLogId, one.getMessage());
                }
            }
            if (made > 0) {
                log.info("ai-call-actions: created {} action(s) for call {} (agent {})",
                        made, callLogId, agent.getId());
            }
            return made;
        } catch (Exception e) {
            log.warn("ai-call-actions: post-call evaluation failed for call {} (non-fatal): {}",
                    callLogId, e.getMessage());
            return 0;
        }
    }

    /**
     * Mid-call: the bot emitted a SEND sentinel while still talking. Fires every MID_CALL
     * rule carrying that artefact key with NO predicate evaluation — the live conversation
     * IS the evidence, and there is no post-call analysis yet to evaluate against.
     *
     * <p>The key must be one the agent actually published, so a hallucinated sentinel sends
     * nothing.
     *
     * @return how many actions were created
     */
    public int applyMidCall(AiAgent agent, String instituteId, String callLogId,
                            String userId, String responseId, String artefactKey,
                            String leadName) {
        if (!actionsEnabled || agent == null || callLogId == null || !notBlank(artefactKey)) {
            return 0;
        }
        String key = artefactKey.trim();
        int made = 0;
        for (AiCallActionRule rule : rulesOf(agent)) {
            if (!TIMING_MID_CALL.equalsIgnoreCase(timingOf(rule))) continue;
            if (!key.equalsIgnoreCase(rule.getArtefact())) continue;
            try {
                if (create(rule, instituteId, callLogId, userId, responseId, leadName,
                           "Requested by the AI agent during the call")) {
                    made++;
                }
            } catch (Exception one) {
                log.warn("ai-call-actions: mid-call rule {} failed for call {}: {}",
                        rule.getId(), callLogId, one.getMessage());
            }
        }
        return made;
    }

    /**
     * Write one action row. Returns false when this exact (call, rule) pair already has one —
     * the unique index on (source, source_ref) is the guard, NOT a prior SELECT, because a
     * check-then-insert races with itself across replicas.
     */
    private boolean create(AiCallActionRule rule, String instituteId, String callLogId,
                           String userId, String responseId, String leadName, String rationale) {
        String actionType = rule.getActionType().trim().toUpperCase(Locale.ROOT);
        String channel = rule.getChannel() == null ? null
                : rule.getChannel().trim().toUpperCase(Locale.ROOT);
        if (ACTION_BOOK_MEETING.equals(actionType)) {
            channel = null;                                  // a booking has no send channel
        } else {
            if (!SEND_ACTION_TYPES.contains(actionType) || channel == null
                    || !CHANNELS.contains(channel)) {
                log.warn("ai-call-actions: rule {} has an unsendable action/channel {}/{} — skipped",
                        rule.getId(), actionType, channel);
                return false;
            }
            // A WhatsApp send with no template is rejected at dispatch anyway (Meta needs an
            // approved template); refusing it here keeps a dead row out of the ledger.
            if ("WHATSAPP".equals(channel) && !notBlank(rule.getTemplate())) {
                log.warn("ai-call-actions: WhatsApp rule {} has no template — skipped", rule.getId());
                return false;
            }
            // Email is sent VERBATIM from draft_body (no template layer), with its first line
            // as the subject. Without a message we would mail the caller our own internal
            // note. Skipping is strictly better than sending that.
            if ("EMAIL".equals(channel) && !notBlank(rule.getMessageBody())) {
                log.warn("ai-call-actions: email rule {} has no message body — skipped", rule.getId());
                return false;
            }
        }

        String engineId = provisioner.engineIdFor(instituteId);
        String memberId = provisioner.memberIdFor(engineId, instituteId, userId, responseId);
        if (memberId == null) {
            log.warn("ai-call-actions: call {} has neither user nor lead id — cannot address rule {}",
                    callLogId, rule.getId());
            return false;
        }

        EngagementAction a = new EngagementAction();
        a.setEngineId(engineId);
        a.setMemberId(memberId);
        a.setInstituteId(instituteId);
        // A BOOK_MEETING carries no channel, so EngagementDispatcher cannot fire it — left as
        // a SEND it would be rejected every tick and demoted to a task anyway, with a FAILED
        // row in between. Make it a task outright. The calendar entry itself is still created
        // post-call by maybeAutoBookMeeting, which is the only place the agreed TIME exists;
        // this row is the human-visible "confirm the advisor call" counterpart.
        boolean booking = ACTION_BOOK_MEETING.equals(actionType);
        a.setKind(booking || "TASK".equalsIgnoreCase(actionMode) ? "TASK" : "SEND");
        a.setActionType(actionType);
        a.setChannel(channel);
        // OPEN, not PENDING: findDueAutoSends selects kind=SEND AND status=OPEN, and the copilot
        // inbox selects kind IN (TASK,REPLY) at the same status. One value serves both modes.
        a.setStatus("OPEN");
        a.setTemplateName(blankToNull(rule.getTemplate()));
        a.setTemplateLanguage(blankToNull(rule.getTemplateLanguage()));
        a.setVariablesJson(variablesJson(leadName));
        a.setDraftBody(draftBody(rule, channel, leadName));
        a.setRationale(rationale + " — rule "
                + (notBlank(rule.getLabel()) ? rule.getLabel() : rule.getId()) + ".");
        a.setExpiresAt(Instant.now().plus(Math.max(1, expiryHours), ChronoUnit.HOURS));
        a.setSource(SOURCE);
        a.setSourceRef(callLogId + ":" + rule.getId());
        try {
            actionRepository.save(a);
            return true;
        } catch (DataIntegrityViolationException dup) {
            // Already created for this (call, rule). A replayed report or a reprocessed
            // outcome must not send the brochure twice.
            log.info("ai-call-actions: action already exists for call {} rule {} — skipping",
                    callLogId, rule.getId());
            return false;
        }
    }

    private String variablesJson(String leadName) {
        try {
            Map<String, String> vars = new HashMap<>();
            vars.put("name", leadName == null || leadName.isBlank() ? "" : leadName.trim());
            return mapper.writeValueAsString(vars);
        } catch (Exception e) {
            return "{}";
        }
    }

    /**
     * For EMAIL this IS the message the person receives (and its first line is the subject),
     * so it must be the admin's copy, never ours. For WhatsApp and BOOK_MEETING it is only
     * what a human sees in the copilot inbox — a proactive WhatsApp send ignores the body
     * entirely and renders the Meta template from templateName + variables.
     */
    private String draftBody(AiCallActionRule rule, String channel, String leadName) {
        String who = (leadName == null || leadName.isBlank()) ? "" : leadName.trim();
        if ("EMAIL".equals(channel) && notBlank(rule.getMessageBody())) {
            return rule.getMessageBody().replace("{{name}}", who).trim();
        }
        String what = notBlank(rule.getLabel()) ? rule.getLabel()
                : (notBlank(rule.getArtefact()) ? rule.getArtefact() : rule.getActionType());
        return "Send " + what + " to " + (who.isEmpty() ? "the caller" : who)
                + " (promised on the AI call).";
    }

    private static String timingOf(AiCallActionRule r) {
        return notBlank(r.getTiming()) ? r.getTiming().trim() : TIMING_POST_CALL;
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }
}
