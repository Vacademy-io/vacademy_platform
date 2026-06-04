package vacademy.io.admin_core_service.features.telephony.spi;

import vacademy.io.admin_core_service.features.telephony.spi.dto.BridgeCallRequest;
import vacademy.io.admin_core_service.features.telephony.spi.dto.OutboundCallHandle;
import vacademy.io.admin_core_service.features.telephony.spi.dto.ProviderCredentials;

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
}
