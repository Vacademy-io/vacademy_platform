package vacademy.io.notification_service.features.webhook.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.notification_service.features.webhook.dto.UnifiedWebhookEvent;
import vacademy.io.notification_service.features.webhook.handler.MetaWebhookHandler;
import vacademy.io.notification_service.features.webhook.service.WebhookEventProcessor;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Meta (Facebook) WhatsApp Webhook Controller
 * 
 * Handles webhook callbacks from Meta WhatsApp Business API.
 * 
 * Meta INCLUDES phone_number_id in the payload (metadata.phone_number_id),
 * so URL-based channel ID is optional but supported.
 * 
 * Configure this URL in Meta Developer Dashboard:
 * https://your-domain.com/notification-service/webhook/v1/meta
 */
@RestController
@RequestMapping("notification-service/webhook/v1/meta")
@RequiredArgsConstructor
@Slf4j
public class MetaWebhookController {

    private final MetaWebhookHandler metaHandler;
    private final WebhookEventProcessor eventProcessor;

    /**
     * Meta webhook verification endpoint (GET request).
     * Meta sends a GET request to verify the webhook URL during setup.
     */
    @GetMapping
    public ResponseEntity<String> verifyWebhook(
            @RequestParam(name = "hub.mode", required = false) String mode,
            @RequestParam(name = "hub.verify_token", required = false) String verifyToken,
            @RequestParam(name = "hub.challenge", required = false) String challenge) {

        log.info("Meta webhook verification: mode={}, token={}", mode, verifyToken);

        // TODO: Validate verifyToken against your configured secret
        if ("subscribe".equals(mode) && challenge != null) {
            log.info("Meta webhook verified successfully");
            return ResponseEntity.ok(challenge);
        }

        return ResponseEntity.badRequest().body("Invalid verification request");
    }

    /**
     * Main Meta webhook endpoint.
     * Meta includes phone_number_id in the payload, so we extract it during
     * parsing.
     */
    @PostMapping
    public ResponseEntity<Map<String, String>> handleWebhook(
            @RequestBody String payload,
            @RequestHeader HttpHeaders headers) {

        log.info("Received Meta webhook: {}", truncatePayload(payload));
        return processPayload(payload, headers, null);
    }

    /**
     * Meta webhook with optional URL channel ID override.
     * Useful if you want to force a specific channel ID regardless of payload.
     */
    @PostMapping("/{channelId}")
    public ResponseEntity<Map<String, String>> handleWebhookWithChannel(
            @PathVariable String channelId,
            @RequestBody String payload,
            @RequestHeader HttpHeaders headers) {

        log.info("Received Meta webhook for channel [{}]: {}", channelId, truncatePayload(payload));
        return processPayload(payload, headers, channelId);
    }

    /**
     * Health check endpoint for Meta webhook.
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(Map.of(
                "status", "healthy",
                "vendor", "META",
                "handler", metaHandler.getClass().getSimpleName(),
                "channelIdSource", "payload.metadata.phone_number_id",
                "timestamp", LocalDateTime.now().toString()));
    }

    /**
     * Common method to process Meta payloads.
     */
    private ResponseEntity<Map<String, String>> processPayload(
            String payload,
            HttpHeaders headers,
            String urlChannelId) {
        try {
            // Step 1: Verify signature
            if (!metaHandler.verifySignature(payload, headers)) {
                log.warn("Meta signature verification failed");
                return metaHandler.buildErrorResponse("Signature verification failed");
            }

            // Step 2: Extract business channel ID (Meta provides in payload)
            String businessChannelId = metaHandler.extractBusinessChannelId(payload, headers, urlChannelId);

            // Step 3: Parse to unified event with context
            var context = new vacademy.io.notification_service.features.webhook.handler.VendorWebhookHandler.WebhookContext(
                    businessChannelId);
            UnifiedWebhookEvent event = metaHandler.parse(payload, headers, context);

            log.info("Parsed Meta event: type={}, messageId={}, channelId={}",
                    event.getEventType(), event.getExternalMessageId(), event.getBusinessChannelId());

            // Step 4: Process via common processor
            eventProcessor.processEvent(event);

            // Step 5: Return success
            return metaHandler.buildSuccessResponse();

        } catch (Exception e) {
            log.error("Error processing Meta webhook: {}", e.getMessage(), e);
            return metaHandler.buildErrorResponse(e.getMessage());
        }
    }

    private String truncatePayload(String payload) {
        if (payload == null)
            return "null";
        return payload.length() <= 500 ? payload : payload.substring(0, 500) + "...";
    }
}
