package vacademy.io.admin_core_service.features.telephony.spi.dto;

import lombok.Builder;
import lombok.Value;

/**
 * Provider-neutral inbound call context. Every Connect-applet style adapter
 * normalises its own webhook params (Exotel's CallFrom/CallTo/CallSid, Plivo's
 * From/To/CallUUID, Twilio's From/To/CallSid, ...) into this shape before
 * handing it to the routing service. The service never sees provider strings.
 */
@Value
@Builder
public class InboundRouteRequest {
    /** Resolved institute the dialled number belongs to. */
    String instituteId;
    /** Caller's phone (the lead). */
    String fromNumber;
    /** Our ExoPhone (or equivalent) the lead dialled. */
    String toNumber;
    /** Provider-side call identifier (Exotel CallSid, etc.). */
    String providerCallId;
    /** The TelephonyProviderNumber row that owns {@link #toNumber}. */
    ProviderNumberView dialledNumber;
}
