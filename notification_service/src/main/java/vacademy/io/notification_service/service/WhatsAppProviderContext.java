package vacademy.io.notification_service.service;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Builder;
import lombok.Data;

/**
 * Context object returned by WhatsAppProviderFactory.
 * Contains both the provider implementation and the normalized credentials
 * node.
 * This eliminates instanceof checks and credential guessing in the OTP service.
 */
@Data
@Builder
public class WhatsAppProviderContext {

    /**
     * The resolved provider implementation (Meta or WATI)
     */
    private WhatsAppServiceProvider provider;

    /**
     * The normalized credentials node for this provider.
     * For Meta: contains { "accessToken": "...", "phoneNumberId": "..." }
     * For WATI: contains { "apiKey": "...", "apiUrl": "...", "whatsappNumber":
     * "..." }
     */
    private JsonNode credentials;

    /**
     * The provider type (for logging/debugging)
     */
    private String providerType;
}
