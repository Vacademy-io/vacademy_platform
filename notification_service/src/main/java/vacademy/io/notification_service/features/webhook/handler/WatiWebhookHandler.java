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
                // WATI timestamps are epoch SECONDS (10 digits), not milliseconds
                .timestamp(timestampMs > 0 ? Instant.ofEpochSecond(timestampMs) : Instant.now())
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
        // text can be JSON null → asText() returns "null" string, so use asText(null) + null check
        String messageText = root.path("text").isNull() ? null : root.path("text").asText(null);
        long timestampMs = root.path("timestamp").asLong();
        String senderName = root.path("senderName").asText(null);
        String messageId = root.path("id").asText(null);
        String msgType = root.path("type").asText("text");

        // Extract interactive reply fields for chatbot flow engine
        String buttonId = null;
        String buttonPayload = null;
        String listReplyId = null;

        JsonNode interactiveReply = root.path("interactiveButtonReply");
        if (!interactiveReply.isMissingNode() && !interactiveReply.isNull() && interactiveReply.isObject()) {
            buttonId = interactiveReply.path("id").asText(null);
            if (messageText == null || messageText.isBlank()) {
                messageText = interactiveReply.path("title").asText("");
            }
        }

        JsonNode listReply = root.path("listReply");
        if (!listReply.isMissingNode() && !listReply.isNull() && listReply.isObject()) {
            String listId = listReply.path("id").asText(null);
            String listTitle = listReply.path("title").asText(null);
            String listDesc = listReply.path("description").asText(null);
            log.info("WATI listReply: id={}, title={}, description={}", listId, listTitle, listDesc);
            // WATI list rows may not have IDs — use title as fallback ID for condition matching
            listReplyId = (listId != null && !listId.isBlank()) ? listId : listTitle;
            if (messageText == null || messageText.isBlank()) {
                messageText = listTitle != null ? listTitle : "";
            }
        }

        JsonNode btnReply = root.path("buttonReply");
        if (!btnReply.isMissingNode() && !btnReply.isNull() && btnReply.isObject()) {
            buttonPayload = btnReply.path("id").asText(null);
            if (messageText == null || messageText.isBlank()) {
                messageText = btnReply.path("text").asText("");
            }
        }

        // Check if this is an outgoing message (our own send confirmation)
        // WATI sends webhooks for outgoing messages with owner=true and eventType like
        // sessionMessageSent, sessionMessageSent_v2, sentMessageDELIVERED, sentMessageREAD etc.
        boolean isOwner = root.path("owner").asBoolean(false);
        String watiEventType = root.path("eventType").asText("");

        UnifiedWebhookEvent.EventType eventType;
        if (isOwner || watiEventType.startsWith("sessionMessageSent")
                || watiEventType.startsWith("sentMessage")) {
            // Outgoing message status — map to appropriate status event, NOT a reply
            if (watiEventType.contains("DELIVERED")) {
                eventType = UnifiedWebhookEvent.EventType.DELIVERED;
            } else if (watiEventType.contains("READ")) {
                eventType = UnifiedWebhookEvent.EventType.READ;
            } else {
                eventType = UnifiedWebhookEvent.EventType.SENT;
            }
        } else {
            eventType = UnifiedWebhookEvent.EventType.REPLY;
        }

        return UnifiedWebhookEvent.builder()
                .vendor(getVendorName())
                .channel(UnifiedWebhookEvent.Channels.WHATSAPP)
                .eventType(eventType)
                .externalMessageId(messageId)
                .phoneNumber(whatsappNumber)
                .messageText(messageText)
                .messageType(msgType)
                .buttonId(buttonId)
                .buttonPayload(buttonPayload)
                .listReplyId(listReplyId)
                .senderName(senderName)
                // WATI timestamps are epoch SECONDS (10 digits), not milliseconds
                .timestamp(timestampMs > 0 ? Instant.ofEpochSecond(timestampMs) : Instant.now())
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
