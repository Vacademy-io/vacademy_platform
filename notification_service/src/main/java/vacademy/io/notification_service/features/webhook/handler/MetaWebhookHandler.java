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
 * Meta (Facebook) WhatsApp webhook handler.
 * Parses Meta-specific webhook payloads into unified event format.
 * 
 * Meta webhooks INCLUDE phone_number_id in the payload:
 * entry[0].changes[0].value.metadata.phone_number_id
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class MetaWebhookHandler implements VendorWebhookHandler {

    private final ObjectMapper objectMapper;

    @Override
    public String getVendorName() {
        return UnifiedWebhookEvent.Vendors.META;
    }

    @Override
    public boolean canHandle(String payload, HttpHeaders headers) {
        try {
            JsonNode root = objectMapper.readTree(payload);
            return root.has("object") &&
                    "whatsapp_business_account".equals(root.path("object").asText());
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Extract business channel ID from Meta payload.
     * Meta includes phone_number_id in:
     * entry[0].changes[0].value.metadata.phone_number_id
     */
    @Override
    public String extractBusinessChannelId(String payload, HttpHeaders headers, String urlChannelId) {
        // If URL channel ID is provided, it takes priority
        if (urlChannelId != null && !urlChannelId.isBlank()) {
            log.debug("Using URL-provided channel ID: {}", urlChannelId);
            return urlChannelId;
        }

        // Otherwise extract from payload
        try {
            JsonNode root = objectMapper.readTree(payload);
            JsonNode entry = root.path("entry").get(0);
            if (entry != null) {
                JsonNode changes = entry.path("changes").get(0);
                if (changes != null) {
                    String phoneNumberId = changes.path("value").path("metadata").path("phone_number_id").asText(null);
                    if (phoneNumberId != null) {
                        log.debug("Extracted phone_number_id from Meta payload: {}", phoneNumberId);
                        return phoneNumberId;
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Failed to extract phone_number_id from Meta payload: {}", e.getMessage());
        }

        return null;
    }

    @Override
    public UnifiedWebhookEvent parse(String payload, HttpHeaders headers) {
        try {
            JsonNode root = objectMapper.readTree(payload);
            Map<String, Object> rawPayload = objectMapper.convertValue(root,
                    new TypeReference<Map<String, Object>>() {
                    });

            // Extract business channel ID from payload
            String businessChannelId = extractBusinessChannelId(payload, headers, null);

            // Navigate to the changes array
            JsonNode entry = root.path("entry").get(0);
            if (entry == null) {
                return buildUnknownEvent(rawPayload, businessChannelId);
            }

            JsonNode changes = entry.path("changes").get(0);
            if (changes == null) {
                return buildUnknownEvent(rawPayload, businessChannelId);
            }

            JsonNode value = changes.path("value");

            // Check if this is a status update or incoming message
            if (value.has("statuses") && value.path("statuses").isArray() && value.path("statuses").size() > 0) {
                return parseStatusUpdate(value.path("statuses").get(0), rawPayload, businessChannelId);
            } else if (value.has("messages") && value.path("messages").isArray() && value.path("messages").size() > 0) {
                return parseIncomingMessage(value.path("messages").get(0), value.path("contacts"), rawPayload,
                        businessChannelId);
            }

            return buildUnknownEvent(rawPayload, businessChannelId);

        } catch (Exception e) {
            log.error("Failed to parse Meta webhook payload: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to parse Meta webhook payload", e);
        }
    }

    private UnifiedWebhookEvent parseStatusUpdate(JsonNode status, Map<String, Object> rawPayload,
            String businessChannelId) {
        String messageId = status.path("id").asText();
        String recipientId = status.path("recipient_id").asText();
        String statusValue = status.path("status").asText();
        long timestamp = status.path("timestamp").asLong();

        UnifiedWebhookEvent.EventType eventType = mapMetaStatusToUnified(statusValue);

        UnifiedWebhookEvent.UnifiedWebhookEventBuilder builder = UnifiedWebhookEvent.builder()
                .vendor(getVendorName())
                .channel(UnifiedWebhookEvent.Channels.WHATSAPP)
                .eventType(eventType)
                .externalMessageId(messageId)
                .phoneNumber(recipientId)
                .businessChannelId(businessChannelId)
                .timestamp(timestamp > 0 ? Instant.ofEpochSecond(timestamp) : Instant.now())
                .rawPayload(rawPayload);

        // Handle errors for failed status
        if (eventType == UnifiedWebhookEvent.EventType.FAILED) {
            JsonNode errors = status.path("errors");
            if (errors.isArray() && errors.size() > 0) {
                JsonNode error = errors.get(0);
                builder.errorCode(String.valueOf(error.path("code").asInt()))
                        .errorMessage(error.path("title").asText("Unknown error"));
            }
        }

        return builder.build();
    }

    private UnifiedWebhookEvent parseIncomingMessage(JsonNode message, JsonNode contacts,
            Map<String, Object> rawPayload, String businessChannelId) {
        String messageId = message.path("id").asText();
        String from = message.path("from").asText();
        String type = message.path("type").asText();
        long timestamp = message.path("timestamp").asLong();

        // Get message text based on type
        String messageText = null;
        if ("text".equals(type)) {
            messageText = message.path("text").path("body").asText();
        } else if ("button".equals(type)) {
            messageText = message.path("button").path("text").asText();
        } else if ("interactive".equals(type)) {
            JsonNode interactive = message.path("interactive");
            if (interactive.has("button_reply")) {
                messageText = interactive.path("button_reply").path("title").asText();
            } else if (interactive.has("list_reply")) {
                messageText = interactive.path("list_reply").path("title").asText();
            }
        }

        // Get sender name from contacts
        String senderName = null;
        if (contacts != null && contacts.isArray() && contacts.size() > 0) {
            senderName = contacts.get(0).path("profile").path("name").asText(null);
        }

        // Determine if this is a verification response
        UnifiedWebhookEvent.EventType eventType = isVerificationResponse(messageText)
                ? UnifiedWebhookEvent.EventType.VERIFICATION_RESPONSE
                : UnifiedWebhookEvent.EventType.REPLY;

        return UnifiedWebhookEvent.builder()
                .vendor(getVendorName())
                .channel(UnifiedWebhookEvent.Channels.WHATSAPP)
                .eventType(eventType)
                .externalMessageId(messageId)
                .phoneNumber(from)
                .messageText(messageText)
                .senderName(senderName)
                .businessChannelId(businessChannelId)
                .timestamp(timestamp > 0 ? Instant.ofEpochSecond(timestamp) : Instant.now())
                .rawPayload(rawPayload)
                .build();
    }

    private UnifiedWebhookEvent.EventType mapMetaStatusToUnified(String metaStatus) {
        if (metaStatus == null) {
            return UnifiedWebhookEvent.EventType.UNKNOWN;
        }
        return switch (metaStatus.toLowerCase()) {
            case "sent" -> UnifiedWebhookEvent.EventType.SENT;
            case "delivered" -> UnifiedWebhookEvent.EventType.DELIVERED;
            case "read" -> UnifiedWebhookEvent.EventType.READ;
            case "failed" -> UnifiedWebhookEvent.EventType.FAILED;
            default -> UnifiedWebhookEvent.EventType.UNKNOWN;
        };
    }

    private boolean isVerificationResponse(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        String upperText = text.trim().toUpperCase();
        return upperText.equals("VERIFY") ||
                upperText.equals("YES") ||
                upperText.equals("CONFIRM") ||
                upperText.matches("^\\d{4,6}$");
    }

    private UnifiedWebhookEvent buildUnknownEvent(Map<String, Object> rawPayload, String businessChannelId) {
        return UnifiedWebhookEvent.builder()
                .vendor(getVendorName())
                .channel(UnifiedWebhookEvent.Channels.WHATSAPP)
                .eventType(UnifiedWebhookEvent.EventType.UNKNOWN)
                .businessChannelId(businessChannelId)
                .rawPayload(rawPayload)
                .timestamp(Instant.now())
                .build();
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

    @Override
    public boolean verifySignature(String payload, HttpHeaders headers) {
        // TODO: Implement Meta signature verification with X-Hub-Signature-256
        return true;
    }
}
