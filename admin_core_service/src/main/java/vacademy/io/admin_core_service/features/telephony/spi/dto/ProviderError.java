package vacademy.io.admin_core_service.features.telephony.spi.dto;

import lombok.Builder;
import lombok.Value;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderErrorCode;

/**
 * An adapter's translation of a raw provider failure into a neutral
 * {@link ProviderErrorCode} + a user-facing message. The orchestrator surfaces
 * the message; the frontend can key UI off the code. Produced by
 * {@code OutboundCallInitiator.translateError}.
 */
@Value
@Builder
public class ProviderError {
    ProviderErrorCode code;
    String userMessage;

    public static ProviderError of(ProviderErrorCode code, String userMessage) {
        return ProviderError.builder().code(code).userMessage(userMessage).build();
    }

    public static ProviderError unknown(String userMessage) {
        return of(ProviderErrorCode.UNKNOWN,
                userMessage != null ? userMessage : "Could not place call right now. Try again in a moment.");
    }
}
