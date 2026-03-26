package vacademy.io.notification_service.features.combot.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.notification_service.features.combot.entity.ChannelToInstituteMapping;
import vacademy.io.notification_service.features.combot.repository.ChannelToInstituteMappingRepository;
import vacademy.io.notification_service.features.combot.service.CombotWebhookService;
import vacademy.io.notification_service.features.chatbot_flow.engine.ChatbotFlowEngine;
import vacademy.io.notification_service.features.notification_log.entity.NotificationLog;
import vacademy.io.notification_service.features.notification_log.repository.NotificationLogRepository;

import java.time.LocalDateTime;
import java.util.*;

/**
 * WATI webhook controller.
 * WATI sends a flat JSON payload (not nested like Meta Cloud API).
 * This controller normalizes WATI format and routes to the chatbot flow engine
 * and legacy ChannelFlowConfig processing.
 *
 * WATI webhook payload example:
 * {
 *   "id": "...",
 *   "waId": "918612345678",
 *   "text": "hello",
 *   "type": "text",
 *   "eventType": "message",
 *   "senderName": "John",
 *   "channelPhoneNumber": "17435002445",
 *   "listReply": null,
 *   "interactiveButtonReply": null,
 *   "buttonReply": null
 * }
 */
@RestController
@RequestMapping("/notification-service/v1/webhook")
@RequiredArgsConstructor
@Slf4j
public class WatiWebhookController {

    private final ChatbotFlowEngine chatbotFlowEngine;
    private final CombotWebhookService combotWebhookService;
    private final ChannelToInstituteMappingRepository mappingRepository;
    private final NotificationLogRepository notificationLogRepository;
    private final ObjectMapper objectMapper;

    /**
     * WATI webhook endpoint. Receives flat JSON from WATI.
     * Handles: message, sentMessageDELIVERED_v2, sentMessageREAD, templateMessageFailed, etc.
     */
    @PostMapping("/wati")
    public ResponseEntity<String> handleWatiWebhook(@RequestBody Map<String, Object> payload) {
        try {
            log.info("WATI webhook received");
            log.debug("WATI payload: {}", objectMapper.writeValueAsString(payload));

            String eventType = (String) payload.get("eventType");
            if (eventType == null) {
                log.warn("WATI webhook missing eventType");
                return ResponseEntity.ok("Missing eventType");
            }

            switch (eventType) {
                case "message", "newContactMessage" -> handleIncomingMessage(payload);
                case "sentMessageDELIVERED_v2" -> handleStatusUpdate(payload, "delivered");
                case "sentMessageREAD" -> handleStatusUpdate(payload, "read");
                case "templateMessageFailed" -> handleStatusUpdate(payload, "failed");
                case "sentMessageREPLIED" -> handleIncomingMessage(payload); // Reply is also an incoming message
                default -> log.debug("Ignoring WATI event type: {}", eventType);
            }

            return ResponseEntity.ok("WATI webhook processed");

        } catch (Exception e) {
            log.error("Error processing WATI webhook", e);
            return ResponseEntity.ok("Error handled");
        }
    }

    /**
     * Process incoming WATI message. Normalizes to common format and routes to:
     * 1. Chatbot flow engine (new graph-based)
     * 2. Legacy ChannelFlowConfig (fallback)
     */
    private void handleIncomingMessage(Map<String, Object> payload) {
        String userPhone = (String) payload.get("waId");
        String channelPhoneNumber = (String) payload.get("channelPhoneNumber");
        String messageText = extractWatiMessageText(payload);
        String messageId = (String) payload.get("whatsappMessageId");
        String msgType = (String) payload.getOrDefault("type", "text");

        if (userPhone == null) {
            log.warn("WATI webhook missing waId");
            return;
        }

        // Look up institute from channel mapping
        // WATI uses channelPhoneNumber (the business number), map it to an institute
        Optional<ChannelToInstituteMapping> mappingOpt = findMappingByWatiNumber(channelPhoneNumber);
        if (mappingOpt.isEmpty()) {
            log.warn("No institute mapped for WATI channel: {}", channelPhoneNumber);
            return;
        }

        ChannelToInstituteMapping mapping = mappingOpt.get();
        String instituteId = mapping.getInstituteId();
        String channelType = mapping.getChannelType();

        // Log incoming message
        logIncomingMessage(messageId, userPhone, messageText, channelPhoneNumber);

        // Extract button/list reply IDs
        String buttonId = extractWatiButtonId(payload);
        String buttonPayload = extractWatiButtonPayload(payload);
        String listReplyId = extractWatiListReplyId(payload);

        // 1. Try chatbot flow engine first (new graph-based)
        boolean handled = chatbotFlowEngine.handleIncomingMessage(
                instituteId, channelType, userPhone, messageText,
                channelPhoneNumber, msgType, buttonId, buttonPayload, listReplyId);

        if (handled) {
            log.info("WATI message handled by chatbot flow engine: phone={}", userPhone);
            return;
        }

        // 2. Fall back to legacy: normalize to Meta-like format and route through CombotWebhookService
        // Build a Meta-compatible value map so the existing service can process it
        Map<String, Object> metaValue = buildMetaCompatibleValue(payload, channelPhoneNumber);
        Map<String, Object> entry = Map.of("id", channelPhoneNumber);

        try {
            combotWebhookService.processIncomingMessageFromWebhook(metaValue, entry);
        } catch (Exception e) {
            log.error("Failed to process WATI message through legacy flow: {}", e.getMessage());
        }
    }

    /**
     * Extract message text from WATI's flat payload.
     * Handles: text, button replies, interactive replies, list replies.
     */
    private String extractWatiMessageText(Map<String, Object> payload) {
        String type = (String) payload.getOrDefault("type", "text");

        // Direct text
        String text = (String) payload.get("text");
        if (text != null && !text.isBlank()) return text;

        // Interactive button reply
        @SuppressWarnings("unchecked")
        Map<String, Object> interactiveReply = (Map<String, Object>) payload.get("interactiveButtonReply");
        if (interactiveReply != null) {
            String title = (String) interactiveReply.get("title");
            if (title != null) return title;
        }

        // List reply
        @SuppressWarnings("unchecked")
        Map<String, Object> listReply = (Map<String, Object>) payload.get("listReply");
        if (listReply != null) {
            String title = (String) listReply.get("title");
            if (title != null) return title;
        }

        // Button reply (template quick reply)
        @SuppressWarnings("unchecked")
        Map<String, Object> buttonReply = (Map<String, Object>) payload.get("buttonReply");
        if (buttonReply != null) {
            String btnText = (String) buttonReply.get("text");
            if (btnText != null) return btnText;
        }

        return "";
    }

    private String extractWatiButtonId(Map<String, Object> payload) {
        @SuppressWarnings("unchecked")
        Map<String, Object> interactiveReply = (Map<String, Object>) payload.get("interactiveButtonReply");
        if (interactiveReply != null) {
            return (String) interactiveReply.get("id");
        }
        return null;
    }

    private String extractWatiButtonPayload(Map<String, Object> payload) {
        @SuppressWarnings("unchecked")
        Map<String, Object> buttonReply = (Map<String, Object>) payload.get("buttonReply");
        if (buttonReply != null) {
            return (String) buttonReply.get("id");
        }
        return null;
    }

    private String extractWatiListReplyId(Map<String, Object> payload) {
        @SuppressWarnings("unchecked")
        Map<String, Object> listReply = (Map<String, Object>) payload.get("listReply");
        if (listReply != null) {
            return (String) listReply.get("id");
        }
        return null;
    }

    /**
     * Find ChannelToInstituteMapping by WATI business phone number.
     * WATI channels use the display number (e.g., "17435002445") rather than Meta's phone_number_id.
     * Try both the raw number and as channel_id.
     */
    private Optional<ChannelToInstituteMapping> findMappingByWatiNumber(String channelPhoneNumber) {
        if (channelPhoneNumber == null) return Optional.empty();

        // Try direct lookup by channel_id
        Optional<ChannelToInstituteMapping> mapping = mappingRepository.findById(channelPhoneNumber);
        if (mapping.isPresent()) return mapping;

        // Try with digits only (strip formatting)
        String digitsOnly = channelPhoneNumber.replaceAll("[^0-9]", "");
        return mappingRepository.findById(digitsOnly);
    }

    /**
     * Build a Meta Cloud API-compatible value map from WATI flat payload.
     * This allows the existing CombotWebhookService.processIncomingMessageFromWebhook to process it.
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> buildMetaCompatibleValue(Map<String, Object> watiPayload, String channelPhoneNumber) {
        String userPhone = (String) watiPayload.get("waId");
        String text = extractWatiMessageText(watiPayload);
        String type = (String) watiPayload.getOrDefault("type", "text");
        String messageId = (String) watiPayload.get("whatsappMessageId");

        // Build Meta-like message object
        Map<String, Object> message = new LinkedHashMap<>();
        message.put("from", userPhone);
        message.put("id", messageId);
        message.put("timestamp", String.valueOf(System.currentTimeMillis() / 1000));

        // Convert WATI message types to Meta format
        Map<String, Object> interactiveReply = (Map<String, Object>) watiPayload.get("interactiveButtonReply");
        Map<String, Object> listReply = (Map<String, Object>) watiPayload.get("listReply");
        Map<String, Object> buttonReply = (Map<String, Object>) watiPayload.get("buttonReply");

        if (interactiveReply != null) {
            message.put("type", "interactive");
            message.put("interactive", Map.of(
                    "type", "button_reply",
                    "button_reply", Map.of(
                            "id", interactiveReply.getOrDefault("id", ""),
                            "title", interactiveReply.getOrDefault("title", "")
                    )
            ));
        } else if (listReply != null) {
            message.put("type", "interactive");
            message.put("interactive", Map.of(
                    "type", "list_reply",
                    "list_reply", Map.of(
                            "id", listReply.getOrDefault("id", ""),
                            "title", listReply.getOrDefault("title", ""),
                            "description", listReply.getOrDefault("description", "")
                    )
            ));
        } else if (buttonReply != null) {
            message.put("type", "button");
            message.put("button", Map.of(
                    "text", buttonReply.getOrDefault("text", ""),
                    "payload", buttonReply.getOrDefault("id", "")
            ));
        } else {
            message.put("type", "text");
            message.put("text", Map.of("body", text));
        }

        // Build Meta-like value object
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("messaging_product", "whatsapp");
        value.put("metadata", Map.of(
                "display_phone_number", channelPhoneNumber,
                "phone_number_id", channelPhoneNumber
        ));
        value.put("contacts", List.of(Map.of(
                "profile", Map.of("name", watiPayload.getOrDefault("senderName", "")),
                "wa_id", userPhone
        )));
        value.put("messages", List.of(message));

        return value;
    }

    private void handleStatusUpdate(Map<String, Object> payload, String status) {
        try {
            String messageId = (String) payload.get("whatsappMessageId");
            String channelPhone = (String) payload.get("channelPhoneNumber");

            NotificationLog statusLog = new NotificationLog();
            statusLog.setNotificationType("WHATSAPP_MESSAGE_" + status.toUpperCase());
            statusLog.setChannelId((String) payload.get("waId"));
            statusLog.setBody("WATI status: " + status);
            statusLog.setSource("WATI");
            statusLog.setSourceId(messageId);
            statusLog.setSenderBusinessChannelId(channelPhone);
            statusLog.setNotificationDate(LocalDateTime.now());

            notificationLogRepository.save(statusLog);
            log.debug("WATI status logged: status={}, messageId={}", status, messageId);
        } catch (Exception e) {
            log.error("Failed to log WATI status: {}", e.getMessage());
        }
    }

    private void logIncomingMessage(String messageId, String userPhone, String text, String channelPhoneNumber) {
        try {
            NotificationLog inLog = new NotificationLog();
            inLog.setNotificationType("WHATSAPP_MESSAGE_INCOMING");
            inLog.setChannelId(userPhone);
            inLog.setBody(text);
            inLog.setSource("WATI");
            inLog.setSourceId(messageId);
            inLog.setSenderBusinessChannelId(channelPhoneNumber);
            inLog.setNotificationDate(LocalDateTime.now());
            notificationLogRepository.save(inLog);
        } catch (Exception e) {
            log.error("Failed to log WATI incoming message: {}", e.getMessage());
        }
    }
}
