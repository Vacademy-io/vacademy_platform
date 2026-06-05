package vacademy.io.admin_core_service.features.telephony.spi;

import jakarta.servlet.http.HttpServletRequest;
import vacademy.io.admin_core_service.features.telephony.spi.dto.NormalizedCallEvent;
import vacademy.io.admin_core_service.features.telephony.spi.dto.ProviderSecrets;

/**
 * Verify + parse one inbound status callback in a provider-specific shape.
 * The webhook controller dispatches to the matching handler via the
 * ?provider= query param.
 */
public interface CallWebhookHandler {
    String providerType();

    boolean verify(HttpServletRequest req, String body, ProviderSecrets secrets);

    NormalizedCallEvent parse(HttpServletRequest req, String body);
}
