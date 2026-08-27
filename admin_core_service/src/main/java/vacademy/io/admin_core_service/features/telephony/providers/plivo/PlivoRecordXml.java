package vacademy.io.admin_core_service.features.telephony.providers.plivo;

/**
 * The single place that knows how to ask Plivo to record a bridged conversation.
 *
 * <p><b>Why this exists.</b> Recording a two-party bridge is a sibling
 * {@code <Record>} element placed BEFORE {@code <Dial>} — Plivo's {@code <Dial>}
 * has <b>no</b> {@code record} attribute. (Twilio's does; that is where the old
 * {@code record="true" recordCallbackUrl="…"} on {@code <Dial>} came from.) Plivo
 * silently drops unknown attributes, so the old markup started no recording and
 * never fired a record callback: every outbound human Plivo call ever placed on
 * this platform has a NULL {@code recording_url}, while the AI path — which serves
 * a genuine {@code <Record recordSession="true">} from voice_bot_service — records
 * fine. All three places that bridge two humans on Plivo — the outbound counsellor
 * bridge (PlivoCallbackController), the inbound IVR DIAL node (PlivoIvrRenderer) and
 * the no-IVR inbound fallback (PlivoInboundResponseRenderer) — build their recording
 * through here, so they cannot drift apart again.
 *
 * <p><b>Attribute choices</b> (docs: plivo.com/docs/voice/xml/record):
 * <ul>
 *   <li>{@code startOnDialAnswer="true"} — start when the far leg PICKS UP, and
 *       record the complete session from there. Nothing is recorded when nobody
 *       answers, so a NO_ANSWER row can never be flipped COMPLETED by a stray
 *       record event (PlivoCallWebhookHandler maps any RecordUrl to COMPLETED).</li>
 *   <li>{@code callbackUrl} — NOT {@code action}. The action URL fires when the
 *       recording STARTS and reports {@code RecordingDuration=-1}; callbackUrl
 *       fires when the mp3 is READY. RecordingPersistenceService begins fetching
 *       30s after the event, so the action URL would race a file Plivo has not
 *       finished writing and burn the whole 30/45/90s retry ladder on a long call.</li>
 *   <li>{@code maxLength} — Plivo's default is <b>60 SECONDS</b>, not unlimited.
 *       Left unset it would truncate ~19% of calls (227 of 1,185 answered Plivo
 *       calls have run past a minute; the longest is 16m). One hour covers every
 *       Plivo call in the platform's history with room to spare, and matches the
 *       value the AI path already runs in production.</li>
 *   <li>{@code redirect="false"} — never hand call flow to the recording callback;
 *       control must stay with {@code <Dial>}. (Plivo defaults this to true.)</li>
 *   <li>{@code fileFormat} left at its default (mp3) on purpose —
 *       RecordingTxOps#looksLikeMp3 rejects WAV bytes as a corrupt download.</li>
 * </ul>
 */
final class PlivoRecordXml {

    /**
     * Recording cap in seconds. MUST be set explicitly on every {@code <Record>}:
     * Plivo's own default is 60 seconds.
     */
    private static final int MAX_LENGTH_SECONDS = 3600;

    private PlivoRecordXml() {}

    /**
     * {@code <Record>} for a bridged conversation. Emit this IMMEDIATELY BEFORE the
     * {@code <Dial>} whose audio it should capture.
     *
     * @param statusBase the call's status-webhook base
     *                   ({@code …/webhook/status?provider=PLIVO&corr=…[&token=…]});
     *                   {@code &plivoEvent=record} is appended so
     *                   PlivoCallWebhookHandler recognises the event.
     */
    static String bridgeRecord(String statusBase) {
        return "<Record startOnDialAnswer=\"true\" redirect=\"false\""
                + " maxLength=\"" + MAX_LENGTH_SECONDS + "\""
                + " callbackUrl=\"" + esc(statusBase + "&plivoEvent=record") + "\""
                + " callbackMethod=\"POST\"/>";
    }

    /** XML-escape an attribute value (the callback URLs carry &, which must be &amp;). */
    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }
}
