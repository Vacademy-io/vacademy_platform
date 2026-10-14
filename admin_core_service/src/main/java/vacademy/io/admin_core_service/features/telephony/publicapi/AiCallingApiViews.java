package vacademy.io.admin_core_service.features.telephony.publicapi;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.media_service.service.MediaService;
import vacademy.io.admin_core_service.features.telephony.core.AiCallOutcomeProcessor;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.AiCallResult;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.TelephonyCallLog;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.AiCallResultRepository;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.TelephonyCallLogRepository;
import vacademy.io.admin_core_service.features.telephony.publicapi.entity.AiCallApiCall;
import vacademy.io.admin_core_service.features.telephony.publicapi.repository.AiCallApiCallRepository;
import vacademy.io.admin_core_service.features.telephony.queue.entity.AiCallQueueItem;
import vacademy.io.admin_core_service.features.telephony.queue.repository.AiCallQueueItemRepository;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

/**
 * Builds the public view of a call from its three records — the API row, the queue item
 * and (once dialled) the call log plus its newest AI result — and decides whether the
 * call is FINAL (can no longer change). The API and the webhook job share this, so a
 * webhook says exactly what GET /v1/calls/{id} says.
 *
 * <p>Public statuses: queued, dialing, in_progress, completed, no_answer, busy, failed,
 * canceled, expired. "completed" means the call connected; it becomes final once the AI
 * outcome and the recording are attached, or {@link #OUTCOME_WAIT} after the call ended
 * if they never arrive. A call that never reports an end is failed after
 * {@link #STUCK_AFTER}, so every call gets exactly one webhook.
 *
 * <p>The only writes here are targeted, idempotent column fills (call_log_id,
 * terminal_seen_at); nothing saves the whole row.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AiCallingApiViews {

    public static final Set<String> FINAL_STATUSES =
            Set.of("completed", "no_answer", "busy", "failed", "canceled", "expired");
    /** How long a connected call waits for its outcome (and recording) after it ended. */
    static final Duration OUTCOME_WAIT = Duration.ofMinutes(10);
    /** Once the outcome is in, how long to wait for the recording copy before sending anyway. */
    static final Duration RECORDING_WAIT = Duration.ofMinutes(3);
    /** A call that has not reported an end this long after it was dialled is treated as lost. */
    static final Duration STUCK_AFTER = Duration.ofHours(2);
    /** Between the insert and the queue link, a row has neither; it is still being created. */
    static final Duration CREATING_GRACE = Duration.ofMinutes(5);
    /** Pre-signed recording links live this long (MediaService presigns for one day). */
    static final Duration RECORDING_LINK_TTL = Duration.ofHours(24);
    static final String NO_RESULT = "No result was received for this call.";

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Set<String> CALL_LOG_TERMINAL = Set.of("COMPLETED", "NO_ANSWER", "BUSY", "FAILED", "CANCELLED");

    private final AiCallApiCallRepository callRepository;
    private final AiCallQueueItemRepository queueRepository;
    private final TelephonyCallLogRepository callLogRepository;
    private final AiCallResultRepository resultRepository;
    private final MediaService mediaService;
    private final AiCallingUsageService usageService;

    /** A computed state: the public status, whether it is final, and the records behind it. */
    public record State(String status, boolean isFinal, String reason, Instant scheduledFor,
                        AiCallQueueItem queueItem, TelephonyCallLog callLog, AiCallResult result) {
    }

    public State state(AiCallApiCall c) {
        Instant now = Instant.now();
        AiCallQueueItem q = c.getQueueItemId() == null ? null
                : queueRepository.findById(c.getQueueItemId()).orElse(null);
        if (c.getCallLogId() == null && q != null && q.getCallLogId() != null) {
            c.setCallLogId(q.getCallLogId());
            try {
                callRepository.setCallLogIdIfNull(c.getId(), q.getCallLogId());
            } catch (RuntimeException e) {
                log.debug("ai-calling-api: could not record call log id for {}: {}", c.getId(), e.getMessage());
            }
        }
        TelephonyCallLog l = c.getCallLogId() == null ? null : callLogRepository.findById(c.getCallLogId()).orElse(null);
        AiCallResult r = l == null ? null : newestResult(l.getId());

        if (l == null) {
            if (q == null) {
                // Still being created (the queue link or, for a test call, the call log is
                // written a moment after the insert): not final yet.
                boolean creating = c.getCreatedAt() == null || c.getCreatedAt().plus(CREATING_GRACE).isAfter(now);
                if (creating) return new State(c.isTestMode() ? "dialing" : "queued", false, null, null, null, null, null);
                return new State("failed", true, "The call could not be placed.", null, null, null, null);
            }
            String qs = q.getStatus() == null ? "" : q.getStatus();
            return switch (qs) {
                case "QUEUED" -> {
                    Instant scheduled = q.getNotBefore() != null && q.getNotBefore().isAfter(now) ? q.getNotBefore() : null;
                    String reason = q.getStatusReason();
                    if ((reason == null || reason.isBlank()) && scheduled != null) {
                        reason = "Waiting for the next calling window.";
                    }
                    yield new State("queued", false, reason, scheduled, q, null, null);
                }
                case "DISPATCHING", "DIALED" -> {
                    Instant since = q.getDispatchedAt() != null ? q.getDispatchedAt() : q.getUpdatedAt();
                    if (since != null && since.plus(STUCK_AFTER).isBefore(now)) {
                        yield new State("failed", true, NO_RESULT, null, q, null, null);
                    }
                    yield new State("dialing", false, null, null, q, null, null);
                }
                case "CANCELLED" -> new State("canceled", true, q.getStatusReason(), null, q, null, null);
                case "EXPIRED" -> new State("expired", true,
                        q.getStatusReason() == null ? "No line became free before the call expired." : q.getStatusReason(),
                        null, q, null, null);
                default -> new State("failed", true,
                        q.getStatusReason() != null ? q.getStatusReason() : q.getLastError(), null, q, null, null);
            };
        }

        String ls = l.getStatus() == null ? "" : l.getStatus();
        if (CALL_LOG_TERMINAL.contains(ls) && c.getTerminalSeenAt() == null) {
            c.setTerminalSeenAt(now);
            try {
                callRepository.setTerminalSeenAtIfNull(c.getId(), now);
            } catch (RuntimeException e) {
                log.debug("ai-calling-api: could not record end for {}: {}", c.getId(), e.getMessage());
            }
        }
        String reason = l.getTerminationReason();
        return switch (ls) {
            case "COMPLETED" -> {
                boolean processed = r != null && "PROCESSED".equalsIgnoreCase(r.getProcessingStatus());
                Instant ended = c.getTerminalSeenAt() == null ? now : c.getTerminalSeenAt();
                // A test call never has a recording; a real one gets it copied shortly after
                // the outcome. Send once both are in, or give up waiting for either.
                boolean recordingSettled = c.isTestMode() || l.getRecordingStorageKey() != null
                        || ended.plus(RECORDING_WAIT).isBefore(now);
                boolean waitedOut = ended.plus(OUTCOME_WAIT).isBefore(now);
                yield new State("completed", (processed && recordingSettled) || waitedOut, null, null, q, l, r);
            }
            case "NO_ANSWER" -> new State("no_answer", true, reason, null, q, l, r);
            case "BUSY" -> new State("busy", true, reason, null, q, l, r);
            case "FAILED" -> new State("failed", true, reason, null, q, l, r);
            case "CANCELLED" -> new State("canceled", true, reason, null, q, l, r);
            default -> {
                Instant dialed = l.getCreatedAt() == null ? null : l.getCreatedAt().toInstant();
                if (dialed != null && dialed.plus(STUCK_AFTER).isBefore(now)) {
                    yield new State("failed", true, NO_RESULT, null, q, l, r);
                }
                boolean talking = "IN_PROGRESS".equals(ls) || "COUNSELLOR_ANSWERED".equals(ls);
                yield new State(talking ? "in_progress" : "dialing", false, null, null, q, l, r);
            }
        };
    }

    /** The public call object. {@code brief} skips the outcome, recording and cost (counts only). */
    public Map<String, Object> call(AiCallApiCall c, boolean brief) {
        return call(c, state(c), brief);
    }

    public Map<String, Object> call(AiCallApiCall c, State s, boolean brief) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", c.getId());
        m.put("object", "call");
        m.put("status", s.status());
        if (s.reason() != null && !s.reason().isBlank()) m.put("status_reason", s.reason());
        if (s.scheduledFor() != null) m.put("scheduled_for", s.scheduledFor().toString());
        m.put("agent_id", c.getAgentId());
        m.put("phone_number", c.getPhoneNumber());
        Map<String, Object> contact = new LinkedHashMap<>();
        contact.put("name", c.getContactName());
        contact.put("email", c.getContactEmail());
        contact.put("external_id", c.getExternalId());
        m.put("contact", contact);
        m.put("variables", c.getVariables() == null ? Map.of() : c.getVariables());
        m.put("metadata", c.getMetadata() == null ? Map.of() : c.getMetadata());
        m.put("batch_id", c.getBatchId());
        m.put("test", c.isTestMode());
        if (brief) return m;

        TelephonyCallLog l = s.callLog();
        AiCallResult r = s.result();
        Integer duration = l != null && l.getDurationSeconds() != null ? l.getDurationSeconds()
                : r != null ? r.getDurationSeconds() : null;
        m.put("duration_seconds", duration);
        m.put("created_at", c.getCreatedAt() == null ? null : c.getCreatedAt().toString());
        Instant dialedAt = s.queueItem() != null && s.queueItem().getDispatchedAt() != null
                ? s.queueItem().getDispatchedAt()
                : l != null && l.getCreatedAt() != null ? l.getCreatedAt().toInstant() : null;
        m.put("dialed_at", dialedAt == null ? null : dialedAt.toString());
        Instant endedAt = s.isFinal() ? endedAt(c, l, r, dialedAt, duration) : null;
        m.put("ended_at", endedAt == null ? null : endedAt.toString());

        String recordingUrl = recordingUrl(l);
        m.put("recording_url", recordingUrl);
        m.put("recording_expires_at", recordingUrl == null ? null
                : Instant.now().plus(RECORDING_LINK_TTL).toString());
        m.put("cost", usageService.costOfCall(c, l, r));
        m.put("outcome", outcome(r));
        return m;
    }

    /** When the call ended: the carrier's end time, else start + duration, else when we saw it end. */
    static Instant endedAt(AiCallApiCall c, TelephonyCallLog l, AiCallResult r, Instant dialedAt, Integer duration) {
        if (l != null && l.getEndTime() != null) return l.getEndTime().toInstant();
        Instant start = r != null && r.getCallStart() != null ? r.getCallStart() : dialedAt;
        if (start != null && duration != null && l != null) return start.plusSeconds(duration);
        if (c.getTerminalSeenAt() != null) return c.getTerminalSeenAt();
        return c.getFinalizedAt();
    }

    private Map<String, Object> outcome(AiCallResult r) {
        if (r == null || !"PROCESSED".equalsIgnoreCase(r.getProcessingStatus())) return null;
        // A call our own bot broke (health RED with a silence/loop fault) is not the
        // contact's verdict: never hand the client a "Not interested" from it.
        boolean broken = AiCallOutcomeProcessor.isUntrustworthyCall(r);
        Map<String, Object> o = new LinkedHashMap<>();
        o.put("call_quality", broken ? "failed" : "ok");
        o.put("disposition", broken ? "Incomplete" : r.getDisposition());
        o.put("summary", r.getAiSummary());
        o.put("answers", r.getExtractedQa() == null ? Map.of() : r.getExtractedQa());
        o.put("lead_rating", broken ? null : r.getLeadRating());
        o.put("callback_requested", Boolean.TRUE.equals(r.getCallback()));
        o.put("callback_time_text", r.getCallbackTimeText());
        o.put("follow_up", r.getFollowUp());
        o.put("follow_up_note", r.getFollowUpGist());
        o.put("meeting", meeting(r.getRawPayload()));
        o.put("transcript", transcript(r.getTranscript()));
        return o;
    }

    /**
     * The meeting the contact agreed to on the call, from the bot's report (kept verbatim
     * in raw_payload): requested only when they agreed to a specific day or time.
     */
    static Map<String, Object> meeting(String rawPayload) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("requested", false);
        m.put("at", null);
        m.put("time_text", null);
        m.put("type", null);
        if (rawPayload == null || rawPayload.isBlank()) return m;
        try {
            JsonNode root = JSON.readTree(rawPayload);
            if (root == null || !root.isObject()) return m;
            m.put("requested", root.path("meetingRequested").asBoolean(false));
            m.put("at", text(root.path("meetingDatetimeIso")));
            m.put("time_text", text(root.path("meetingDatetimeText")));
            m.put("type", text(root.path("meetingType")));
        } catch (Exception e) {
            log.debug("ai-calling-api: unreadable report payload: {}", e.getMessage());
        }
        return m;
    }

    private static String text(JsonNode n) {
        return n == null || n.isNull() || n.isMissingNode() || n.asText().isBlank() ? null : n.asText();
    }

    /** "user: …" / "assistant: …" lines → [{speaker: contact|agent, text}]. */
    static List<Map<String, String>> transcript(String raw) {
        List<Map<String, String>> turns = new ArrayList<>();
        if (raw == null || raw.isBlank()) return turns;
        for (String line : raw.split("\n")) {
            String speaker = null;
            String text = line;
            if (line.startsWith("user:")) {
                speaker = "contact";
                text = line.substring(5);
            } else if (line.startsWith("assistant:")) {
                speaker = "agent";
                text = line.substring(10);
            }
            text = text.trim();
            if (speaker == null) {
                // A line break inside a turn: append it to the previous turn.
                if (!turns.isEmpty() && !text.isEmpty()) {
                    Map<String, String> last = turns.get(turns.size() - 1);
                    last.put("text", (last.get("text") + " " + text).trim());
                }
                continue;
            }
            if (text.isEmpty()) continue;
            Map<String, String> t = new LinkedHashMap<>();
            t.put("speaker", speaker);
            t.put("text", text);
            turns.add(t);
        }
        return turns;
    }

    private String recordingUrl(TelephonyCallLog l) {
        if (l == null || l.getRecordingStorageKey() == null) return null;
        try {
            String url = Boolean.TRUE.equals(l.getRecordingPrivate())
                    ? mediaService.getFileUrlById(l.getRecordingStorageKey())
                    : mediaService.getFilePublicUrlById(l.getRecordingStorageKey());
            return url == null || url.isBlank() ? null : url;
        } catch (RuntimeException e) {
            log.warn("ai-calling-api: recording link failed for call log {}: {}", l.getId(), e.getMessage());
            return null;
        }
    }

    private AiCallResult newestResult(String callLogId) {
        List<AiCallResult> rows = resultRepository.findByCallLogIdIn(List.of(callLogId));
        AiCallResult best = null;
        for (AiCallResult r : rows) {
            if (best == null || newer(r, best)) best = r;
        }
        return best;
    }

    private static boolean newer(AiCallResult a, AiCallResult b) {
        Instant ta = a.getReceivedAt() != null ? a.getReceivedAt().toInstant()
                : a.getCreatedAt() != null ? a.getCreatedAt().toInstant() : Instant.EPOCH;
        Instant tb = b.getReceivedAt() != null ? b.getReceivedAt().toInstant()
                : b.getCreatedAt() != null ? b.getCreatedAt().toInstant() : Instant.EPOCH;
        return ta.isAfter(tb);
    }
}
