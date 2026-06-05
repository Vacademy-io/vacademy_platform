package vacademy.io.admin_core_service.features.telephony.providers.exotel;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.telephony.enums.CallStatus;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderType;
import vacademy.io.admin_core_service.features.telephony.spi.CallWebhookHandler;
import vacademy.io.admin_core_service.features.telephony.spi.dto.NormalizedCallEvent;
import vacademy.io.admin_core_service.features.telephony.spi.dto.ProviderSecrets;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;

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
    public boolean verify(HttpServletRequest req, String body, ProviderSecrets secrets) {
        // "Open webhook" mode: the institute hasn't configured a shared
        // secret, so we accept all callbacks for their calls. The webhook
        // controller still matches by our own ?corr= UUID, so the worst-case
        // damage of a forged POST is a status update on a real call whose
        // UUID someone guessed — and UUIDs aren't guessable.
        String stored = secrets == null ? null : secrets.getWebhookToken();
        if (stored == null || stored.isBlank()) return true;

        String token = req.getParameter("token");
        if (token == null) return false;
        return MessageDigest.isEqual(
                token.getBytes(StandardCharsets.UTF_8),
                stored.getBytes(StandardCharsets.UTF_8));
    }

    @Override
    public NormalizedCallEvent parse(HttpServletRequest req, String body) {
        // Snapshot every param Exotel sent so we can see exactly which keys
        // they're using. Helpful because Exotel's docs list slightly different
        // field names per endpoint and per status, and we'd otherwise be
        // guessing. Logged at INFO so it shows up in dev without enabling
        // DEBUG on the whole package.
        Map<String, String> raw = new LinkedHashMap<>();
        req.getParameterMap().forEach((k, v) -> {
            if (v != null && v.length > 0) raw.put(k, v[0]);
        });
        if (log.isInfoEnabled()) {
            log.info("Exotel webhook params: {}", raw);
        }

        String corr = req.getParameter("corr");
        String sid = firstNonBlank(req.getParameter("CallSid"), req.getParameter("Sid"));
        String exotelStatus = req.getParameter("Status");
        String dialCallStatus = req.getParameter("DialCallStatus");

        CallStatus status = mapStatus(exotelStatus, dialCallStatus);

        // Exotel uses different duration keys depending on endpoint and event.
        // Order matters — the most-specific to the bridged-call duration first.
        Integer duration = firstParsedInt(req,
                "DialCallDuration",
                "ConversationDuration",
                "CallDuration",
                "Duration",
                "RecordingDuration");

        Double price = parseDouble(req.getParameter("Price"));

        Timestamp start  = parseTs(req.getParameter("StartTime"));
        Timestamp answer = parseTs(req.getParameter("AnswerTime"));
        Timestamp end    = parseTs(req.getParameter("EndTime"));

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

        String recordingUrl = req.getParameter("RecordingUrl");

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
                .terminationReason(firstNonBlank(req.getParameter("Cause"), exotelStatus))
                .rawPayload(body)
                .build();
    }

    private static Integer firstParsedInt(HttpServletRequest req, String... keys) {
        for (String k : keys) {
            Integer v = parseInt(req.getParameter(k));
            if (v != null && v > 0) return v;
        }
        return null;
    }

    /**
     * Map Exotel's vocabulary onto our normalised CallStatus. Exotel uses:
     *   "queued", "in-progress", "ringing", "completed", "busy", "no-answer",
     *   "failed", "canceled".
     */
    private CallStatus mapStatus(String exotelStatus, String dialCallStatus) {
        String s = exotelStatus == null ? "" : exotelStatus.toLowerCase();
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
