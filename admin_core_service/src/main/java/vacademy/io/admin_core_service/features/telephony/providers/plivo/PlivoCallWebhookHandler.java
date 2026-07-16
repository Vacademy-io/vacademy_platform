package vacademy.io.admin_core_service.features.telephony.providers.plivo;

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

/**
 * Parses Plivo's call callbacks (form-urlencoded). One status endpoint receives
 * several event kinds, distinguished by the {@code ?plivoEvent=} hint we bake into
 * each callback URL (ring / hangup / dial_callback / dial_action / record):
 * <ul>
 *   <li><b>ring</b> → COUNSELLOR_RINGING (parent leg ringing);</li>
 *   <li><b>dial_callback</b> with a b-leg "answer" → IN_PROGRESS (lead picked up);</li>
 *   <li><b>record</b> (carries {@code RecordUrl}) → attaches the recording (mapped to
 *       a terminal status so the controller's terminal+recordingUrl persist fires);</li>
 *   <li><b>hangup / dial_action</b> → terminal, labelled from the lead-leg outcome.</li>
 * </ul>
 * Verification mirrors Exotel: a shared-secret {@code ?token=} when the institute set
 * one, else "open mode" (the unguessable {@code ?corr=} UUID is the guard).
 *
 * <p>COUNSELLOR_ANSWERED is emitted by the answer endpoint (which must return XML),
 * not here.
 */
@Component
public class PlivoCallWebhookHandler implements CallWebhookHandler {

    private static final Logger log = LoggerFactory.getLogger(PlivoCallWebhookHandler.class);

    @Override
    public String providerType() {
        return ProviderType.PLIVO;
    }

    @Override
    public boolean verify(InboundEnvelope env, ProviderSecrets secrets) {
        String stored = secrets == null ? null : secrets.getWebhookToken();
        if (stored == null || stored.isBlank()) return true; // open mode — ?corr= is the guard
        String token = env.param("token");
        if (token == null) return false;
        return MessageDigest.isEqual(
                token.getBytes(StandardCharsets.UTF_8),
                stored.getBytes(StandardCharsets.UTF_8));
    }

    @Override
    public NormalizedCallEvent parse(InboundEnvelope env) {
        if (log.isInfoEnabled()) {
            java.util.Map<String, String> safe = new java.util.LinkedHashMap<>(env.getParams());
            safe.remove("token");
            log.info("Plivo webhook params: {}", safe);
        }

        String corr = env.param("corr");
        String callUuid = env.param("CallUUID");
        String plivoEvent = lower(env.param("plivoEvent"));
        String recordUrl = firstNonBlank(env.param("RecordUrl"), env.param("RecordingUrl"));
        String callStatus = lower(env.param("CallStatus"));
        String hangupCause = firstNonBlank(env.param("HangupCauseName"), env.param("HangupCause"));
        String dialBLeg = lower(firstNonBlank(env.param("DialBLegStatus"), env.param("DialBLegHangupCause")));

        CallStatus status;
        Integer duration = null;

        if (recordUrl != null) {
            // Recording arrives (often after hangup). Map to a terminal status so the
            // webhook controller's terminal+recordingUrl branch persists it; rank rules
            // mean this never regresses a real terminal already on the row. Duration:
            // a hangup that ALSO carries the RecordUrl may be the ONLY event with the
            // call's talk time — read the CALL duration params (Duration/BillDuration;
            // NEVER RecordingDuration, which is the file length not the call) so the
            // voice-minutes meter isn't starved. applyEvent's duration is first-write-
            // wins, so a later/earlier hangup-only event still coexists safely.
            status = CallStatus.COMPLETED;
            duration = firstParsedInt(env, "Duration", "BillDuration");
        } else if ("ring".equals(plivoEvent) || (callStatus != null && callStatus.contains("ringing"))) {
            status = CallStatus.COUNSELLOR_RINGING;
        } else if ("dial_callback".equals(plivoEvent)) {
            // Live b-leg (lead) event. Only advance on a genuine answer; interim
            // events leave status untouched.
            status = (dialBLeg != null && dialBLeg.contains("answer")) ? CallStatus.IN_PROGRESS : null;
        } else {
            // hangup / dial_action / default terminal.
            status = mapTerminal(callStatus, dialBLeg, hangupCause);
            duration = firstParsedInt(env, "Duration", "BillDuration");
        }

        return NormalizedCallEvent.builder()
                .correlationId(corr)
                .providerCallId(callUuid)
                .status(status)
                .durationSeconds(duration)
                .recordingUrl(recordUrl)
                .terminationReason(firstNonBlank(hangupCause, callStatus))
                .rawPayload(env.getRawBody())
                .build();
    }

    /**
     * Label the call from the lead-leg (b-leg) outcome when present (that's "did the
     * lead actually answer?"), else from the parent (counsellor) leg CallStatus.
     */
    private CallStatus mapTerminal(String callStatus, String dialBLeg, String hangupCause) {
        String s = firstNonBlank(dialBLeg, callStatus, lower(hangupCause));
        s = s == null ? "" : s;
        if (s.contains("no-answer") || s.contains("no_answer") || s.contains("timeout")
                || s.contains("noanswer")) return CallStatus.NO_ANSWER;
        if (s.contains("busy"))    return CallStatus.BUSY;
        if (s.contains("cancel") || s.contains("rejected")) return CallStatus.CANCELLED;
        if (s.contains("fail") || s.contains("error") || s.contains("unallocated")
                || s.contains("not-reachable")) return CallStatus.FAILED;
        // "completed" / "answer" / "normal_clearing" / anything else after a hangup → connected.
        return CallStatus.COMPLETED;
    }

    private static Integer firstParsedInt(InboundEnvelope env, String... keys) {
        for (String k : keys) {
            Integer v = parseInt(env.param(k));
            if (v != null && v > 0) return v;
        }
        return null;
    }

    private static Integer parseInt(String s) {
        if (s == null || s.isBlank()) return null;
        try { return Integer.parseInt(s.trim()); } catch (NumberFormatException e) { return null; }
    }

    private static String lower(String s) {
        return s == null ? null : s.toLowerCase();
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
}
