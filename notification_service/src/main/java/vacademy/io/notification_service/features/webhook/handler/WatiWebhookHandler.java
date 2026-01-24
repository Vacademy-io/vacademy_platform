package vacademy.io.notification_service.features.webhook.handler;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import vacademy.io.notification_service.features.webhook.dto.UnifiedWebhookEvent;

import java.time.Instant;
import java.util.Map;

/**
 * WATI (WhatsApp Team Inbox) webhook handler.
 * Parses WATI-specific webhook payloads into unified event format.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class WatiWebhookHandler implements VendorWebhookHandler {

    private final ObjectMapper objectMapper;

    @Override
    public String getVendorName() {
        return UnifiedWebhookEvent.Vendors.WATI;
    }

    @Override
    public boolean canHandle(String payload, HttpHeaders headers) {
        try {
            JsonNode root = objectMapper.readTree(payload);
            return root.has("event") ||
                    (root.has("whatsappNumber") && (root.has("text") || root.has("type")));
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public UnifiedWebhookEvent parse(String payload, HttpHeaders headers) {
        try {
            JsonNode root = objectMapper.readTree(payload);
            Map<String, Object> rawPayload = objectMapper.convertValue(root,
                    new TypeReference<Map<String, Object>>() {
                    });

            if (root.has("event")) {
                return parseStatusUpdate(root, rawPayload);
            } else if (root.has("text") || root.has("type")) {
                return parseIncomingMessage(root, rawPayload);
            } else {
                log.warn("Unknown WATI payload structure: {}", payload);
                return UnifiedWebhookEvent.builder()
                        .vendor(getVendorName())
                        .channel(UnifiedWebhookEvent.Channels.WHATSAPP)
                        .eventType(UnifiedWebhookEvent.EventType.UNKNOWN)
                        .rawPayload(rawPayload)
                        .timestamp(Instant.now())
                        .build();
            }
        } catch (Exception e) {
            log.error("Failed to parse WATI webhook payload: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to parse WATI webhook payload", e);
        }
    }

    private UnifiedWebhookEvent parseStatusUpdate(JsonNode root, Map<String, Object> rawPayload) {
        String event = root.path("event").asText();
        String messageId = root.path("messageId").asText();
        String whatsappNumber = normalizePhoneNumber(root.path("waId").asText());
        long timestampMs = root.path("timestamp").asLong();

        UnifiedWebhookEvent.EventType eventType = mapWatiEventToUnified(event);

        UnifiedWebhookEvent.UnifiedWebhookEventBuilder builder = UnifiedWebhookEvent.builder()
                .vendor(getVendorName())
                .channel(UnifiedWebhookEvent.Channels.WHATSAPP)
                .eventType(eventType)
                .externalMessageId(messageId)
                .phoneNumber(whatsappNumber)
                .timestamp(timestampMs > 0 ? Instant.ofEpochMilli(timestampMs) : Instant.now())
                .rawPayload(rawPayload);

        if (eventType == UnifiedWebhookEvent.EventType.FAILED) {
            JsonNode error = root.path("error");
            if (!error.isMissingNode()) {
                builder.errorCode(error.path("code").asText(null))
                        .errorMessage(error.path("message").asText("Unknown error"));
            } else {
                builder.errorMessage(root.path("status").asText("Failed"));
            }
        }

        return builder.build();
    }

    private UnifiedWebhookEvent parseIncomingMessage(JsonNode root, Map<String, Object> rawPayload) {
        String whatsappNumber = normalizePhoneNumber(root.path("waId").asText());
        String messageText = root.path("text").asText();
        long timestampMs = root.path("timestamp").asLong();
        String senderName = root.path("senderName").asText(null);
        String messageId = root.path("id").asText(null);

        // All incoming messages are REPLY - action routing (via action_template_config)
        // determines if it's verification, workflow trigger, etc.
        UnifiedWebhookEvent.EventType eventType = UnifiedWebhookEvent.EventType.REPLY;

        return UnifiedWebhookEvent.builder()
                .vendor(getVendorName())
                .channel(UnifiedWebhookEvent.Channels.WHATSAPP)
                .eventType(eventType)
                .externalMessageId(messageId)
                .phoneNumber(whatsappNumber)
                .messageText(messageText)
                .senderName(senderName)
                .timestamp(timestampMs > 0 ? Instant.ofEpochMilli(timestampMs) : Instant.now())
                .rawPayload(rawPayload)
                .build();
    }

    private UnifiedWebhookEvent.EventType mapWatiEventToUnified(String watiEvent) {
        if (watiEvent == null) {
            return UnifiedWebhookEvent.EventType.UNKNOWN;
        }
        return switch (watiEvent.toLowerCase()) {
            case "message.sent" -> UnifiedWebhookEvent.EventType.SENT;
            case "message.delivered" -> UnifiedWebhookEvent.EventType.DELIVERED;
            case "message.read" -> UnifiedWebhookEvent.EventType.READ;
            case "message.failed" -> UnifiedWebhookEvent.EventType.FAILED;
            default -> UnifiedWebhookEvent.EventType.UNKNOWN;
        };
    }

    private String normalizePhoneNumber(String phoneNumber) {
        if (phoneNumber == null) {
            return null;
        }
        return phoneNumber.replaceAll("[^0-9]", "");
    }

    @Override
    public ResponseEntity<Map<String, String>> buildSuccessResponse() {
        return ResponseEntity.ok(Map.of("status", "success"));
    }

    @Override
    public ResponseEntity<Map<String, String>> buildErrorResponse(String errorMessage) {
        return ResponseEntity.ok(Map.of(
                "status", "error",
                "message", errorMessage != null ? errorMessage : "Unknown error"));
    }
}
