package vacademy.io.admin_core_service.features.telephony.spi.dto;

import lombok.Builder;
import lombok.Value;

/**
 * What an adapter returns after a successful initiate() — minimum info the
 * orchestrator needs to persist on the call log row.
 */
@Value
@Builder
public class OutboundCallHandle {
    String providerCallId;   // e.g. Exotel CallSid
    String initialStatus;    // raw provider status string for raw_payload reference
}
