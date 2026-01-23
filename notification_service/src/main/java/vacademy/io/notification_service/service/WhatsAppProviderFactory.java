package vacademy.io.notification_service.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Component
public class WhatsAppProviderFactory {

    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;
    // We can inject base Meta url if needed, or pass it from properties
    private final String metaApiBaseUrl;

    @Autowired
    public WhatsAppProviderFactory(ObjectMapper objectMapper, RestTemplate restTemplate,
            @org.springframework.beans.factory.annotation.Value("${meta.whatsapp.api.base.url:https://graph.facebook.com/v22.0}") String metaApiBaseUrl) {
        this.objectMapper = objectMapper;
        this.restTemplate = restTemplate;
        this.metaApiBaseUrl = metaApiBaseUrl;
    }

    public WhatsAppServiceProvider getProvider(JsonNode settingsRoot) {
        // Path Traversal Logic
        // The settingsRoot IS the settings json (e.g. { "WHATSAPP_SETTING": ... })
        // So we should NOT do .path("setting") again.

        // 1. Check for UTILITY_WHATSAPP
        JsonNode utilityWhatsapp = settingsRoot.path("WHATSAPP_SETTING")
                .path("data")
                .path("UTILITY_WHATSAPP");

        if (!utilityWhatsapp.isMissingNode()) {
            // Check provider field
            if (utilityWhatsapp.has("provider")) {
                String provider = utilityWhatsapp.get("provider").asText();
                if ("WATI".equalsIgnoreCase(provider)) {
                    // Use WATI Provider, passing the UTILITY_WHATSAPP node as credentials
                    return new WatiWhatsAppServiceProvider(objectMapper, restTemplate);
                }
            }
        }

        // 2. Check for UTILITY_META_WHATSAPP (New Meta Path)
        JsonNode utilityMetaWhatsapp = settingsRoot.path("WHATSAPP_SETTING")
                .path("data")
                .path("UTILITY_META_WHATSAPP");

        if (!utilityMetaWhatsapp.isMissingNode()
                && "META".equalsIgnoreCase(utilityMetaWhatsapp.path("provider").asText(""))) {
            return new MetaWhatsAppServiceProvider(objectMapper, restTemplate, metaApiBaseUrl);
        }

        // 3. Fallback / Default
        // If nothing matches, we default to Meta (legacy support).
        return new MetaWhatsAppServiceProvider(objectMapper, restTemplate, metaApiBaseUrl);
    }
}
