package vacademy.io.admin_core_service.features.telephony.spi.dto;

import lombok.Builder;
import lombok.Value;

/**
 * Provider-neutral outbound-call request. The adapter translates this into
 * whatever shape its API expects (Exotel: Connect Two Numbers; Plivo:
 * Outbound XML, etc.).
 */
@Value
@Builder
public class BridgeCallRequest {
    /** Counsellor's verified phone number (1st leg). */
    String from;
    /** Lead's phone number (2nd leg). */
    String to;
    /** ExoPhone / virtual number both legs see. */
    String callerId;
    /** Whether to instruct the provider to record. */
    boolean record;
    /** Our own UUID — carried back to us via the StatusCallback ?corr= param. */
    String correlationId;
    /** Absolute URL the provider should POST status updates to. */
    String statusCallbackUrl;
}
