package vacademy.io.admin_core_service.features.telephony.spi;

import vacademy.io.admin_core_service.features.telephony.spi.dto.InboundEnvelope;
import vacademy.io.admin_core_service.features.telephony.spi.dto.NormalizedCallEvent;
import vacademy.io.admin_core_service.features.telephony.spi.dto.ProviderSecrets;

/**
 * Verify + parse one inbound webhook in a provider-specific shape. The webhook
 * controller dispatches to the matching handler via the ?provider= query param.
 *
 * <p>Both methods take a provider-neutral {@link InboundEnvelope} (headers +
 * params + raw body + client IP) rather than the raw servlet request — so a
 * form-POST provider (Exotel) reads {@code env.param(...)}, a signed-JSON
 * provider (Vonage/Airtel) reads {@code env.header(...)} + {@code env.json()}
 * and HMAC-verifies over {@code env.getRawBody()}, all behind the same port.
 */
public interface CallWebhookHandler {
    String providerType();

    boolean verify(InboundEnvelope env, ProviderSecrets secrets);

    NormalizedCallEvent parse(InboundEnvelope env);
}
