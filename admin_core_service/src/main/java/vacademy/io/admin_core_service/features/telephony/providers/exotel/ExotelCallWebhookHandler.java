package vacademy.io.admin_core_service.features.telephony.providers.exotel;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.telephony.enums.CallStatus;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderType;
import vacademy.io.admin_core_service.features.telephony.spi.CallWebhookHandler;
import vacademy.io.admin_core_service.features.telephony.spi.dto.InboundEnvelope;
import vacademy.io.admin_core_service.features.telephony.spi.dto.NormalizedCallEvent;
import vacademy.io.admin_core_service.features.telephony.spi.dto.ProviderSecrets;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.format.DateTimeFormatter;

/**
 * Parses Exotel's StatusCallback. Exotel POSTs both form-urlencoded and JSON
 * depending on configuration — we read the parsed query/form params first
 * (most common) then fall back to the request body if needed.
 *
 * Verification: shared-secret token on the ?token= query param. Constant-time
 * compared. (IP allowlist enforced one layer up in the controller.)
 */
@Component
public class ExotelCallWebhookHandler implements CallWebhookHandler {

    private static final Logger log = LoggerFactory.getLogger(ExotelCallWebhookHandler.class);

    @Override
    public String providerType() {
        return ProviderType.EXOTEL;
    }

    @Override
    public boolean verify(InboundEnvelope env, ProviderSecrets secrets) {
        // "Open webhook" mode: the institute hasn't configured a shared
        // secret, so we accept all callbacks for their calls. The webhook
        // controller still matches by our own ?corr= UUID, so the worst-case
        // damage of a forged POST is a status update on a real call whose
        // UUID someone guessed — and UUIDs aren't guessable.
        String stored = secrets == null ? null : secrets.getWebhookToken();
        if (stored == null || stored.isBlank()) return true;

        String token = env.param("token");
        if (token == null) return false;
        return MessageDigest.isEqual(
                token.getBytes(StandardCharsets.UTF_8),
                stored.getBytes(StandardCharsets.UTF_8));
    }

    @Override
    public NormalizedCallEvent parse(InboundEnvelope env) {
        // Log every param Exotel sent so we can see exactly which keys they're
        // using. Helpful because Exotel's docs list slightly different field
        // names per endpoint and per status, and we'd otherwise be guessing.
        // Logged at INFO so it shows up in dev without enabling DEBUG on the
        // whole package.
        if (log.isInfoEnabled()) {
            // Redact the shared-secret webhook token before logging (verify()
            // compares ?token= against the institute's stored secret).
            java.util.Map<String, String> safe = new java.util.LinkedHashMap<>(env.getParams());
            safe.remove("token");
            log.info("Exotel webhook params: {}", safe);
        }

        String corr = env.param("corr");
        String sid = firstNonBlank(env.param("CallSid"), env.param("Sid"));
        String exotelStatus = env.param("Status");
        String dialCallStatus = env.param("DialCallStatus");
        // Passthru applets (used as the inbound flow's "after the conversation
        // ends" hook) emit a different field set than the Connect-applet's
        // native Status Callback. Specifically: no `Status`, but `CallType`
        // carries the high-level outcome ("completed", "missed", etc.). Read
        // CallType too so the inbound termination flow can fire even when
        // `Status` is absent. Connect-applet status callbacks ignore it.
        String callType = env.param("CallType");
        // When we subscribe to "answered" events, Exotel adds an EventType
        // field on those callbacks. The Leg field (1 or 2) tells us which
        // side answered — for Connect Two Numbers: Leg 1 = counsellor (the
        // From), Leg 2 = lead (the To). Used by mapStatus below.
        String eventType = env.param("EventType");
        String leg = firstNonBlank(env.param("Leg"), env.param("LegNumber"));

        CallStatus status = mapStatus(exotelStatus, dialCallStatus, callType, eventType, leg);

        // Exotel uses different duration keys depending on endpoint and event.
        // Order matters — the most-specific to the bridged-call duration first.
        Integer duration = firstParsedInt(env,
                "DialCallDuration",
                "ConversationDuration",
                "CallDuration",
                "Duration",
                "RecordingDuration");

        Double price = parseDouble(env.param("Price"));

        Timestamp start  = parseTs(env.param("StartTime"));
        Timestamp answer = parseTs(env.param("AnswerTime"));
        Timestamp end    = parseTs(env.param("EndTime"));

        // Fallback: if Exotel didn't send a duration but did send start + end
        // (or answer + end), compute it ourselves. This rescues the "Connected"
        // case where the bridged-call duration was absent from the payload.
        if (duration == null) {
            Timestamp from = answer != null ? answer : start;
            if (from != null && end != null) {
                long seconds = (end.getTime() - from.getTime()) / 1000L;
                if (seconds > 0 && seconds < 24 * 3600) {
                    duration = (int) seconds;
                }
            }
        }

        String recordingUrl = env.param("RecordingUrl");

        return NormalizedCallEvent.builder()
                .correlationId(corr)
                .providerCallId(sid)
                .status(status)
                .durationSeconds(duration)
                .price(price)
                .startTime(start)
                .answerTime(answer)
                .endTime(end)
                .recordingUrl(recordingUrl)
                .terminationReason(firstNonBlank(env.param("Cause"), exotelStatus))
                .rawPayload(env.getRawBody())
                .build();
    }

    private static Integer firstParsedInt(InboundEnvelope env, String... keys) {
        for (String k : keys) {
            Integer v = parseInt(env.param(k));
            if (v != null && v > 0) return v;
        }
        return null;
    }

    /**
     * Map Exotel's vocabulary onto our normalised CallStatus. Exotel sends:
     *   • Status events: "queued", "ringing", "in-progress", "completed",
     *                    "busy", "no-answer", "failed", "canceled"
     *   • Answered events (when subscribed via StatusCallbackEvents=answered):
     *     EventType="answered" plus a Leg/LegNumber field. For Connect Two
     *     Numbers: Leg 1 = the counsellor (From), Leg 2 = the lead (To).
     *
     * The answered events let us split what would otherwise be a single
     * "in-progress" state into two visible UI steps for the counsellor:
     *   COUNSELLOR_ANSWERED (you picked up, we're ringing the lead now) →
     *   IN_PROGRESS (lead picked up, you're connected).
     */
    private CallStatus mapStatus(String exotelStatus, String dialCallStatus,
                                 String callType, String eventType, String leg) {
        // Answered events get priority — they're the granular signal that the
        // raw Status field doesn't expose. Leg 2 = lead picked up = full bridge.
        if (eventType != null && eventType.toLowerCase().contains("answered")) {
            return "2".equals(leg) ? CallStatus.IN_PROGRESS : CallStatus.COUNSELLOR_ANSWERED;
        }

        // Fall back through the multiple "what's the call status" fields
        // Exotel sends across different applet types. Connect-applet status
        // callbacks send `Status`; Passthru applets send `CallType` or
        // `DialCallStatus` instead. First non-blank wins.
        String s = firstNonBlank(exotelStatus, callType, dialCallStatus);
        s = s == null ? "" : s.toLowerCase();

        if (s.contains("queued"))      return CallStatus.QUEUED;
        if (s.contains("in-progress")) return CallStatus.IN_PROGRESS;
        if (s.contains("ringing"))     return CallStatus.COUNSELLOR_RINGING;
        if (s.contains("no-answer"))   return CallStatus.NO_ANSWER;
        if (s.contains("busy"))        return CallStatus.BUSY;
        if (s.contains("failed"))      return CallStatus.FAILED;
        if (s.contains("cancel"))      return CallStatus.CANCELLED;
        if (s.contains("complete"))    return mapCompleted(dialCallStatus);
        return CallStatus.QUEUED;
    }

    private CallStatus mapCompleted(String dialCallStatus) {
        if (dialCallStatus == null) return CallStatus.COMPLETED;
        String d = dialCallStatus.toLowerCase();
        if (d.contains("no-answer")) return CallStatus.NO_ANSWER;
        if (d.contains("busy"))      return CallStatus.BUSY;
        if (d.contains("failed"))    return CallStatus.FAILED;
        if (d.contains("cancel"))    return CallStatus.CANCELLED;
        return CallStatus.COMPLETED;
    }

    private static String firstNonBlank(String a, String b) {
        if (a != null && !a.isBlank()) return a;
        if (b != null && !b.isBlank()) return b;
        return null;
    }

    private static String firstNonBlank(String a, String b, String c) {
        String ab = firstNonBlank(a, b);
        if (ab != null) return ab;
        if (c != null && !c.isBlank()) return c;
        return null;
    }

    private static Integer parseInt(String s) {
        if (s == null || s.isBlank()) return null;
        try { return Integer.parseInt(s.trim()); } catch (NumberFormatException e) { return null; }
    }

    private static Double parseDouble(String s) {
        if (s == null || s.isBlank()) return null;
        try { return Double.parseDouble(s.trim()); } catch (NumberFormatException e) { return null; }
    }

    private static Timestamp parseTs(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            // Exotel uses ISO-8601 like "2024-01-15T10:23:45+05:30"
            Instant inst = DateTimeFormatter.ISO_OFFSET_DATE_TIME
                    .parse(s, Instant::from);
            return Timestamp.from(inst);
        } catch (Exception e) {
            // Some payloads use "yyyy-MM-dd HH:mm:ss"
            try { return Timestamp.valueOf(s); } catch (Exception ignored) { return null; }
        }
    }
}
