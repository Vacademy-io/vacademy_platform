package vacademy.io.notification_service.features.webhook.handler;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import vacademy.io.notification_service.features.webhook.dto.UnifiedWebhookEvent;

import java.util.Map;

/**
 * Strategy interface for vendor-specific webhook handling.
 * Each vendor (WATI, Meta, Twilio, etc.) implements this interface
 * to parse their specific webhook payload format.
 */
public interface VendorWebhookHandler {

    /**
     * Returns the vendor identifier (e.g., "WATI", "META", "TWILIO")
     */
    String getVendorName();

    /**
     * Determines if this handler can process the given payload.
     */
    boolean canHandle(String payload, HttpHeaders headers);

    /**
     * Parses the vendor-specific payload into a unified event model.
     * Use this for vendors that include businessChannelId in payload (e.g., Meta).
     */
    UnifiedWebhookEvent parse(String payload, HttpHeaders headers);

    /**
     * Parses the vendor-specific payload with additional context.
     * Use this when businessChannelId comes from URL or headers (e.g., WATI).
     * 
     * @param payload Raw JSON payload
     * @param headers HTTP headers
     * @param context Additional context (e.g., businessChannelId from URL)
     * @return Unified webhook event with businessChannelId set
     */
    default UnifiedWebhookEvent parse(String payload, HttpHeaders headers, WebhookContext context) {
        UnifiedWebhookEvent event = parse(payload, headers);
        if (context != null && context.getBusinessChannelId() != null) {
            event.setBusinessChannelId(context.getBusinessChannelId());
        }
        return event;
    }

    /**
     * Extracts the business channel ID from available sources.
     * Priority: payload > headers > urlChannelId
     * 
     * @param payload      Raw JSON payload
     * @param headers      HTTP headers
     * @param urlChannelId Channel ID from URL path (if available)
     * @return Business channel ID or null if not found
     */
    default String extractBusinessChannelId(String payload, HttpHeaders headers, String urlChannelId) {
        // Default: use URL channel ID
        return urlChannelId;
    }

    /**
     * Builds the vendor-specific acknowledgement response.
     */
    ResponseEntity<Map<String, String>> buildSuccessResponse();

    /**
     * Builds an error response for the vendor.
     */
    ResponseEntity<Map<String, String>> buildErrorResponse(String errorMessage);

    /**
     * Validates the webhook signature/authenticity (if supported by vendor).
     */
    default boolean verifySignature(String payload, HttpHeaders headers) {
        return true;
    }

    /**
     * Context object containing additional information for parsing.
     * Passed from controller to handler for URL-based or header-based data.
     */
    class WebhookContext {
        private String businessChannelId;
        private String instituteId;

        public WebhookContext() {
        }

        public WebhookContext(String businessChannelId) {
            this.businessChannelId = businessChannelId;
        }

        public String getBusinessChannelId() {
            return businessChannelId;
        }

        public void setBusinessChannelId(String businessChannelId) {
            this.businessChannelId = businessChannelId;
        }

        public String getInstituteId() {
            return instituteId;
        }

        public void setInstituteId(String instituteId) {
            this.instituteId = instituteId;
        }
    }
}
