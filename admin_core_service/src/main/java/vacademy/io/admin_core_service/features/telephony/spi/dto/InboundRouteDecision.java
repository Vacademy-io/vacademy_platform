package vacademy.io.admin_core_service.features.telephony.spi.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

/**
 * The provider-neutral result of an inbound routing decision. Provider-specific
 * adapters (e.g. ExotelInboundResponseBuilder) translate this into the wire
 * shape the Connect-applet expects.
 *
 * Hand-off rules:
 *   • {@code numbersToDial} non-empty + first entry has counsellorUserId set →
 *     ring that counsellor (and the rest as a fallback waterfall).
 *   • {@code numbersToDial} contains only the voicemail leg → voicemail.
 *   • Empty list → no agent and no voicemail; the provider drops the call to
 *     its default "no agents available" handling. We still persist + emit a
 *     missed-call event upstream.
 */
@Value
@Builder
public class InboundRouteDecision {

    /** Strategy that produced this decision (telemetry / debugging). */
    String strategyKey;

    /** The counsellor whose row will be attributed in the call log. NULL when
     *  the decision is voicemail-only and no agent is reachable. */
    String attributedCounsellorUserId;

    /** Lead's user id (when we could resolve it from prior call history). */
    String attributedLeadUserId;

    /** Audience response id linked to {@link #attributedLeadUserId}. */
    String attributedResponseId;

    /** Ordered list of legs the provider should try. Each entry is one
     *  destination — the first answered leg wins. */
    List<DialLeg> numbersToDial;

    /** Record the conversation (mirrors institute_telephony_config.record_calls). */
    boolean record;

    /** Per-leg ring timeout in seconds. Provider may clamp to its own limits. */
    Integer maxRingingSeconds;

    /** Human-readable label for telemetry — never sent to the provider wire. */
    String reason;

    @Value
    @Builder
    public static class DialLeg {
        /** E.164 number to dial. */
        String number;
        /** counsellor_user_id this leg belongs to. NULL for voicemail. */
        String counsellorUserId;
        /** Label for telemetry only ("Anjali" / "Voicemail" / "Hunt-group"). */
        String label;
    }
}
