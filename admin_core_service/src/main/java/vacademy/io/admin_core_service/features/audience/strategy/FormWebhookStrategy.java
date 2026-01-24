package vacademy.io.admin_core_service.features.audience.strategy;

import vacademy.io.admin_core_service.features.audience.dto.ProcessedFormDataDTO;

import java.util.Map;

/**
 * Strategy interface for processing different form provider webhooks
 * Each form provider (Zoho, Google, Microsoft) will have its own implementation
 */
public interface FormWebhookStrategy {
    
    /**
     * Process the raw webhook payload and extract form data
     * @param payload Raw webhook payload from the form provider
     * @return Standardized processed form data
     */
    ProcessedFormDataDTO processWebhookPayload(Map<String, Object> payload);
    
    /**
     * Validate the webhook payload structure
     * @param payload Raw webhook payload
     * @return true if valid, false otherwise
     */
    boolean validatePayload(Map<String, Object> payload);
    
    /**
     * Get the form provider name
     * @return Provider name (e.g., "ZOHO_FORMS")
     */
    String getProviderName();
}
