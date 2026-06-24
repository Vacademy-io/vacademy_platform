package vacademy.io.admin_core_service.features.telephony.spi;

import vacademy.io.admin_core_service.features.telephony.enums.CorrelationStrategy;
import vacademy.io.admin_core_service.features.telephony.spi.dto.BridgeCallRequest;
import vacademy.io.admin_core_service.features.telephony.spi.dto.OutboundCallHandle;
import vacademy.io.admin_core_service.features.telephony.spi.dto.ProviderCredentials;
import vacademy.io.admin_core_service.features.telephony.spi.dto.ProviderError;

/**
 * Single-responsibility port: trigger one bridged outbound call against a
 * specific provider. Adapters live under
 * `features/telephony/providers/<name>/` and are picked up by the registry.
 */
public interface OutboundCallInitiator {
    /** e.g. "EXOTEL", "PLIVO" — must match institute_telephony_config.provider_type. */
    String providerType();

    OutboundCallHandle initiate(BridgeCallRequest req, ProviderCredentials creds);

    /**
     * Best-effort cancel of an in-flight call. Adapters that don't support this
     * should throw UnsupportedOperationException; callers handle that gracefully.
     */
    default void cancel(String providerCallId, ProviderCredentials creds) {
        throw new UnsupportedOperationException(providerType() + " does not support cancel");
    }

    /**
     * Translate a raw provider failure into a neutral code + user message. The
     * orchestrator calls this so error copy is provider-specific without the
     * core hard-coding any one provider's vocabulary. Default = UNKNOWN.
     */
    default ProviderError translateError(Exception e) {
        return ProviderError.unknown(null);
    }

    /**
     * How this provider's callbacks correlate back to our call-log row. Default
     * {@code ECHO_FIELD} (Exotel). Airtel/Vonage return {@code PROVIDER_CALL_ID}
     * because {@code click2dial} carries no id in its response — the webhook
     * controller uses this to decide whether to join by our echoed corr id or by
     * the provider's own call id.
     */
    default CorrelationStrategy correlationStrategy() {
        return CorrelationStrategy.ECHO_FIELD;
    }
}
