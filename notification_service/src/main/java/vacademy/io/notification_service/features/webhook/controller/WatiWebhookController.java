package vacademy.io.notification_service.features.webhook.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.notification_service.features.webhook.dto.UnifiedWebhookEvent;
import vacademy.io.notification_service.features.webhook.handler.VendorWebhookHandler;
import vacademy.io.notification_service.features.webhook.handler.WatiWebhookHandler;
import vacademy.io.notification_service.features.webhook.service.WebhookEventProcessor;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * WATI Webhook Controller
 * 
 * Handles webhook callbacks from WATI (WhatsApp Team Inbox)
 * 
 * WATI does NOT include business channel ID in the payload.
 * Therefore, the channel ID must be provided via URL path parameter.
 * 
 * Configure this URL in WATI dashboard:
 * https://your-domain.com/notification-service/webhook/v1/wati/{channelId}
 * 
 * Example: /notification-service/webhook/v1/wati/WATI_CHANNEL_123
 */
@RestController
@RequestMapping("notification-service/webhook/v1/wati")
@RequiredArgsConstructor
@Slf4j
public class WatiWebhookController {

    private final WatiWebhookHandler watiHandler;
    private final WebhookEventProcessor eventProcessor;

    /**
     * WATI webhook endpoint WITH channel ID in URL (recommended for multi-tenant).
     * 
     * Example: POST /notification-service/webhook/v1/wati/WATI_CHANNEL_123
     */
    @PostMapping("/{channelId}")
    public ResponseEntity<Map<String, String>> handleWebhookWithChannel(
            @PathVariable String channelId,
            @RequestBody String payload,
            @RequestHeader HttpHeaders headers) {

        log.info("Received WATI webhook for channel [{}]: {}", channelId, truncatePayload(payload));
        return processPayload(payload, headers, channelId);
    }

    /**
     * WATI webhook endpoint for incoming messages WITH channel ID.
     */
    @PostMapping("/{channelId}/incoming")
    public ResponseEntity<Map<String, String>> handleIncomingMessageWithChannel(
            @PathVariable String channelId,
            @RequestBody String payload,
            @RequestHeader HttpHeaders headers) {

        log.info("Received WATI incoming message for channel [{}]: {}", channelId, truncatePayload(payload));
        return processPayload(payload, headers, channelId);
    }

    /**
     * Legacy WATI webhook endpoint WITHOUT channel ID (for backward compatibility).
     * Not recommended for multi-tenant deployments.
     */
    @PostMapping
    public ResponseEntity<Map<String, String>> handleWebhook(
            @RequestBody String payload,
            @RequestHeader HttpHeaders headers) {

        log.warn("Received WATI webhook WITHOUT channel ID - multi-tenant features disabled");
        return processPayload(payload, headers, null);
    }

    /**
     * Legacy incoming message endpoint (backward compatibility).
     */
    @PostMapping("/incoming")
    public ResponseEntity<Map<String, String>> handleIncomingMessage(
            @RequestBody String payload,
            @RequestHeader HttpHeaders headers) {

        log.warn("Received WATI incoming WITHOUT channel ID - multi-tenant features disabled");
        return processPayload(payload, headers, null);
    }

    /**
     * Health check endpoint for WATI webhook.
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(Map.of(
                "status", "healthy",
                "vendor", "WATI",
                "handler", watiHandler.getClass().getSimpleName(),
                "urlPattern", "/{channelId} or /{channelId}/incoming",
                "timestamp", LocalDateTime.now().toString()));
    }

    /**
     * Common method to process WATI payloads with optional channel ID.
     */
    private ResponseEntity<Map<String, String>> processPayload(
            String payload,
            HttpHeaders headers,
            String channelId) {
        try {
            // Step 1: Verify signature (if applicable)
            if (!watiHandler.verifySignature(payload, headers)) {
                log.warn("WATI signature verification failed");
                return watiHandler.buildErrorResponse("Signature verification failed");
            }

            // Step 2: Parse to unified event with context
            VendorWebhookHandler.WebhookContext context = new VendorWebhookHandler.WebhookContext(channelId);
            UnifiedWebhookEvent event = watiHandler.parse(payload, headers, context);

            log.info("Parsed WATI event: type={}, messageId={}, channelId={}",
                    event.getEventType(), event.getExternalMessageId(), event.getBusinessChannelId());

            // Step 3: Process via common processor
            eventProcessor.processEvent(event);

            // Step 4: Return success
            return watiHandler.buildSuccessResponse();

        } catch (Exception e) {
            log.error("Error processing WATI webhook: {}", e.getMessage(), e);
            return watiHandler.buildErrorResponse(e.getMessage());
        }
    }

    private String truncatePayload(String payload) {
        if (payload == null)
            return "null";
        return payload.length() <= 500 ? payload : payload.substring(0, 500) + "...";
    }
}
