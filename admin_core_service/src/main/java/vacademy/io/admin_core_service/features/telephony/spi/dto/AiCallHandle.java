package vacademy.io.admin_core_service.features.telephony.spi.dto;

import lombok.Builder;
import lombok.Value;

/**
 * Result of dispatching an AI call. {@code providerCallId} may be null when the
 * provider doesn't return a machine id synchronously (e.g. Aavtaar returns a
 * free-text string) — the real id then arrives on the end-of-call report.
 */
@Value
@Builder
public class AiCallHandle {
    String providerCallId;
    boolean accepted;
    String message;
}
