package vacademy.io.notification_service.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * WATI Webhook Controller
 * 
 * Handles webhook callbacks from WATI for message status updates
 * 
 * Configure this URL in WATI dashboard:
 * https://your-domain.com/notification-service/whatsapp/v1/wati-webhook
 */
@RestController
@RequestMapping("notification-service/whatsapp/v1")
@RequiredArgsConstructor
@Slf4j
public class WatiWebhookController {
    
    private final ObjectMapper objectMapper;
    
    /**
     * WATI webhook endpoint for message status updates
     * 
     * Example webhook payload from WATI:
     * {
     *   "event": "message.delivered",
     *   "messageId": "wamid.xxx",
     *   "whatsappNumber": "919876543210",
     *   "timestamp": 1640995200000,
     *   "status": "delivered"
     * }
     */
    @PostMapping("/wati-webhook")
    public ResponseEntity<Map<String, String>> handleWatiWebhook(@RequestBody String payload) {
        log.info("Received WATI webhook: {}", payload);
        
        try {
            JsonNode webhookData = objectMapper.readTree(payload);
            
            String event = webhookData.path("event").asText();
            String messageId = webhookData.path("messageId").asText();
            String whatsappNumber = webhookData.path("whatsappNumber").asText();
            String status = webhookData.path("status").asText();
            long timestamp = webhookData.path("timestamp").asLong();
            
            log.info("WATI Webhook - Event: {}, MessageId: {}, Number: {}, Status: {}", 
                    event, messageId, whatsappNumber, status);
            
            // Handle different event types
            switch (event) {
                case "message.sent":
                    handleMessageSent(messageId, whatsappNumber, timestamp);
                    break;
                    
                case "message.delivered":
                    handleMessageDelivered(messageId, whatsappNumber, timestamp);
                    break;
                    
                case "message.read":
                    handleMessageRead(messageId, whatsappNumber, timestamp);
                    break;
                    
                case "message.failed":
                    handleMessageFailed(messageId, whatsappNumber, timestamp, webhookData);
                    break;
                    
                default:
                    log.warn("Unknown WATI webhook event: {}", event);
            }
            
            return ResponseEntity.ok(Map.of("status", "success"));
            
        } catch (Exception e) {
            log.error("Error processing WATI webhook: {}", e.getMessage(), e);
            return ResponseEntity.ok(Map.of("status", "error", "message", e.getMessage()));
        }
    }
    
    /**
     * Handle message sent event
     */
    private void handleMessageSent(String messageId, String whatsappNumber, long timestamp) {
        log.info("Message sent - ID: {}, Number: {}", messageId, whatsappNumber);
        
        // TODO: Update recipient_messages table
        // UPDATE recipient_messages 
        // SET status = 'SENT', sent_at = ?
        // WHERE external_message_id = ? OR user_phone = ?
    }
    
    /**
     * Handle message delivered event
     */
    private void handleMessageDelivered(String messageId, String whatsappNumber, long timestamp) {
        log.info("Message delivered - ID: {}, Number: {}", messageId, whatsappNumber);
        
        // TODO: Update recipient_messages table
        // UPDATE recipient_messages 
        // SET status = 'DELIVERED', delivered_at = ?
        // WHERE external_message_id = ? OR user_phone = ?
    }
    
    /**
     * Handle message read event
     */
    private void handleMessageRead(String messageId, String whatsappNumber, long timestamp) {
        log.info("Message read - ID: {}, Number: {}", messageId, whatsappNumber);
        
        // TODO: Update message_interactions table
        // INSERT INTO message_interactions (recipient_message_id, user_id, interaction_type, ...)
        // WHERE recipient_message.external_message_id = ?
    }
    
    /**
     * Handle message failed event
     */
    private void handleMessageFailed(String messageId, String whatsappNumber, long timestamp, JsonNode data) {
        String errorMessage = data.path("error").path("message").asText("Unknown error");
        String errorCode = data.path("error").path("code").asText("");
        
        log.error("Message failed - ID: {}, Number: {}, Error: {} (Code: {})", 
                messageId, whatsappNumber, errorMessage, errorCode);
        
        // TODO: Update recipient_messages table
        // UPDATE recipient_messages 
        // SET status = 'FAILED', error_message = ?
        // WHERE external_message_id = ? OR user_phone = ?
    }
    
    /**
     * WATI webhook for incoming messages (optional)
     * 
     * Use this to handle user replies to WhatsApp messages
     */
    @PostMapping("/wati-webhook/incoming")
    public ResponseEntity<Map<String, String>> handleIncomingMessage(@RequestBody String payload) {
        log.info("Received incoming message from WATI: {}", payload);
        
        try {
            JsonNode messageData = objectMapper.readTree(payload);
            
            String whatsappNumber = messageData.path("whatsappNumber").asText();
            String messageText = messageData.path("text").asText();
            
            log.info("Incoming message - From: {}, Text: {}", whatsappNumber, messageText);
            
            // TODO: Handle incoming message
            // - Find original announcement/message
            // - Create reply in message_replies table
            // - Emit SSE event for MESSAGE_REPLY_ADDED
            
            return ResponseEntity.ok(Map.of("status", "received"));
            
        } catch (Exception e) {
            log.error("Error processing incoming WATI message: {}", e.getMessage(), e);
            return ResponseEntity.ok(Map.of("status", "error"));
        }
    }
    
    /**
     * Health check endpoint for WATI webhook
     */
    @GetMapping("/wati-webhook/health")
    public ResponseEntity<Map<String, String>> webhookHealth() {
        return ResponseEntity.ok(Map.of(
                "status", "healthy",
                "timestamp", LocalDateTime.now().toString()
        ));
    }
    
    // ==================== Data Models ====================
    
    @Data
    public static class WatiWebhookEvent {
        private String event;
        private String messageId;
        private String whatsappNumber;
        private Long timestamp;
        private String status;
        private WatiError error;
    }
    
    @Data
    public static class WatiError {
        private String code;
        private String message;
    }
    
    @Data
    public static class WatiIncomingMessage {
        private String id;
        private String whatsappNumber;
        private String text;
        private String type;
        private Long timestamp;
        private String senderName;
    }
}
