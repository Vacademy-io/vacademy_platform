package vacademy.io.admin_core_service.features.telephony.providers.exotel;

import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.telephony.spi.dto.InboundRouteDecision;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Converts a provider-neutral {@link InboundRouteDecision} into the JSON shape
 * Exotel's Connect applet expects on its dynamic-URL callback.
 *
 * Reference shape (from Exotel docs):
 * <pre>{@code
 * {
 *   "fetch_after_attempt": false,
 *   "destination": { "numbers": ["+9198...", "+9198..."] },
 *   "outgoing_phone_number": "+918047...",
 *   "record": true,
 *   "recording_channels": "dual",
 *   "max_ringing_duration": 30,
 *   "max_conversation_duration": 3600
 * }
 * }</pre>
 *
 * Held as a separate bean so swapping Exotel for another provider's connect
 * shape is a one-file change. We deliberately do not depend on a JSON library
 * here — {@link Map} + Jackson auto-serialization in the controller is enough
 * and keeps the unit-test surface trivial.
 */
@Component
public class ExotelInboundResponseBuilder {

    /** Exotel's hard cap on a single bridged conversation, in seconds. */
    private static final int DEFAULT_MAX_CONVERSATION_SECONDS = 3600;

    /** Default dual-channel recording — agent on one channel, lead on the other. */
    private static final String RECORDING_CHANNELS = "dual";

    /**
     * Build the Connect-applet response payload for one decision.
     *
     * @param decision  routing decision from {@code InboundRoutingService}
     * @param exoPhone  the ExoPhone the lead dialled (becomes
     *                  {@code outgoing_phone_number} — the number the agent
     *                  sees on their phone, completing the recognition loop)
     */
    public Map<String, Object> build(InboundRouteDecision decision, String exoPhone) {
        Map<String, Object> body = new LinkedHashMap<>();

        // false = Exotel should NOT re-fetch this URL between attempts. We
        // gave them the whole waterfall up-front; another GET would just
        // restart routing from scratch with the same input.
        body.put("fetch_after_attempt", false);

        Map<String, Object> destination = new LinkedHashMap<>();
        destination.put("numbers", extractNumbers(decision));
        body.put("destination", destination);

        // Outgoing caller-ID = the ExoPhone the lead originally dialled. The
        // counsellor's phone sees this number, making call-back recognition
        // possible. Exotel auto-picks from the account's allowed list when
        // this is omitted, but on a paid plan with a dedicated ExoPhone we
        // want the explicit value so the recognition loop closes properly.
        String normalisedExoPhone = toE164(exoPhone);
        if (normalisedExoPhone != null) {
            body.put("outgoing_phone_number", normalisedExoPhone);
        }

        body.put("record", decision.isRecord());
        if (decision.isRecord()) {
            body.put("recording_channels", RECORDING_CHANNELS);
        }

        Integer ring = decision.getMaxRingingSeconds();
        if (ring != null && ring > 0) {
            body.put("max_ringing_duration", ring);
        }
        body.put("max_conversation_duration", DEFAULT_MAX_CONVERSATION_SECONDS);

        return body;
    }

    /**
     * Extract phone numbers from the decision, in waterfall order, normalised
     * to E.164 format with a leading +. Exotel's Connect-applet docs are
     * explicit on this: numbers MUST be E.164. Sending {@code 919682419977}
     * (E.164 without the +) or {@code 09682419977} (local Indian format) causes
     * Exotel to silently drop the dial attempt — we confirmed this in trial-
     * account testing where routing logged correctly but the call hung up.
     *
     * Skips blank entries defensively (a strategy with a bug shouldn't make
     * Exotel reject the whole response).
     */
    private static List<String> extractNumbers(InboundRouteDecision decision) {
        List<String> out = new ArrayList<>();
        if (decision == null || decision.getNumbersToDial() == null) return out;
        for (InboundRouteDecision.DialLeg leg : decision.getNumbersToDial()) {
            if (leg == null) continue;
            String normalised = toE164(leg.getNumber());
            if (normalised != null) out.add(normalised);
        }
        return out;
    }

    /**
     * Normalise an Indian phone number to local format with a leading {@code 0}.
     * Returns null for blank/unparseable input — caller skips it.
     *
     * Originally this normalised to E.164 ({@code +91...}) because Exotel's
     * Connect-applet docs explicitly show that format. But every single number
     * surfaced in Exotel's actual dashboard / call logs is local-with-0
     * ({@code 09682419977}, {@code 09513886363}, etc.) — including their own
     * transcription of where they routed a call. Trial-account outbound legs
     * were being silently dropped despite our E.164 response being
     * doc-compliant; switching to the format their dashboard displays is the
     * narrow code experiment to confirm whether this is a format-tolerance
     * issue or a deeper trial-tier restriction.
     *
     * Handles every format auth-service is observed to store:
     *   "+919812345678" → "09812345678" (E.164 → local)
     *   "919812345678"  → "09812345678" (E.164 without + → local)
     *   "09812345678"   → "09812345678" (already local)
     *   "9812345678"    → "09812345678" (bare 10-digit → add leading 0)
     *   "+91 98123 45678" → "09812345678" (whitespace stripped)
     *
     * Anything that doesn't look like an Indian number passes through with
     * a {@code +} prefix so international numbers aren't accidentally mangled.
     */
    static String toE164(String raw) {
        if (raw == null) return null;
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) return null;

        boolean hadPlus = trimmed.startsWith("+");
        String digits = trimmed.replaceAll("[^0-9]", "");
        if (digits.isEmpty()) return null;

        // Indian 13-digit (had a + and 91 prefix): strip 91, prepend 0.
        if (hadPlus && digits.length() == 12 && digits.startsWith("91")) {
            return "0" + digits.substring(2);
        }
        // Indian 12-digit (no + but starts with 91 + 10-digit mobile).
        if (digits.length() == 12 && digits.startsWith("91")) {
            return "0" + digits.substring(2);
        }
        // Indian 11-digit local format (already has leading 0).
        if (digits.length() == 11 && digits.startsWith("0")) {
            return digits;
        }
        // Bare 10-digit Indian mobile.
        if (digits.length() == 10) {
            return "0" + digits;
        }
        // Anything else — likely international. Keep the + prefix if present
        // so Exotel routes it via the international gateway instead of guessing
        // it's a malformed Indian number.
        return hadPlus ? "+" + digits : digits;
    }
}
