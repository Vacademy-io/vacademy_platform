package vacademy.io.admin_core_service.features.payments.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute.service.InstitutePaymentGatewayMappingService;
import vacademy.io.admin_core_service.features.payments.enums.WebHookStatus;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentLog;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentLogRepository;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentLogService;
import vacademy.io.admin_core_service.features.user_subscription.service.UserInstitutePaymentGatewayMappingService;
import vacademy.io.common.payment.enums.PaymentGateway;
import vacademy.io.common.payment.enums.PaymentStatusEnum;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
public class RazorpayWebHookService {

    @Autowired
    private InstitutePaymentGatewayMappingService institutePaymentGatewayMappingService;

    @Autowired
    private WebHookService webHookService;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private PaymentLogService paymentLogService;

    @Autowired
    private UserInstitutePaymentGatewayMappingService userInstitutePaymentGatewayMappingService;

    @Autowired
    private PaymentLogRepository paymentLogRepository;

    /**
     * Processes Razorpay webhook events
     */
    public ResponseEntity<String> processWebHook(String payload, String signature) {
        log.info("Received Razorpay webhook payload.");
        String webhookId = null;

        try {
            // Step 1: Log the incoming webhook
            webhookId = webHookService.saveWebhook(PaymentGateway.RAZORPAY.name(), payload, null);

            // Step 2: Extract instituteId from payload
            String instituteId = extractInstituteId(payload);
            if (instituteId == null) {
                log.warn("Webhook ignored: Missing or invalid 'instituteId' in payload notes.");
                updateWebhookStatus(webhookId, WebHookStatus.FAILED, "Missing instituteId in payload");
                return ResponseEntity.ok("Webhook ignored: No instituteId found.");
            }

            // Step 3: Get webhook secret for signature verification
            String webhookSecret = getWebhookSecret(instituteId);
            if (webhookSecret == null) {
                log.error("Webhook secret not found for institute: {}", instituteId);
                updateWebhookStatus(webhookId, WebHookStatus.FAILED, "Webhook secret not found");
                return ResponseEntity.status(404).body("Unknown institute");
            }

            // Step 4: Verify webhook signature
            if (!verifySignature(payload, signature, webhookSecret)) {
                log.error("Webhook signature verification failed for institute: {}", instituteId);
                updateWebhookStatus(webhookId, WebHookStatus.FAILED, "Invalid signature");
                return ResponseEntity.status(400).body("Invalid signature");
            }

            log.info("Webhook signature verified successfully for institute: {}", instituteId);

            // Step 5: Parse webhook payload
            JsonNode webhookData = objectMapper.readTree(payload);
            String eventType = webhookData.get("event").asText();
            
            log.info("Processing Razorpay event: {} for institute: {}", eventType, instituteId);

            // Step 6: Extract payment entity from payload
            JsonNode paymentEntity = extractPaymentEntity(webhookData);
            if (paymentEntity == null) {
                log.info("Event {} does not contain payment entity. Acknowledging and skipping.", eventType);
                updateWebhookStatus(webhookId, WebHookStatus.PROCESSED, 
                        "Event does not contain payment entity, skipped.");
                return ResponseEntity.ok("Webhook acknowledged, no action taken.");
            }

            // Step 7: Extract orderId from payment notes
            String orderId = extractOrderId(paymentEntity);
            if (orderId == null) {
                log.error("Missing 'orderId' in payment notes for payment_id: {}", 
                        paymentEntity.get("id").asText());
                updateWebhookStatus(webhookId, WebHookStatus.FAILED, "Missing orderId in payment notes");
                return ResponseEntity.status(400).body("Missing orderId in payment notes");
            }

            // Step 8: Update webhook with order details
            webHookService.updateWebHook(webhookId, payload, orderId, eventType);

            // Step 9: Handle different event types
            handleRazorpayEvent(eventType, orderId, instituteId, paymentEntity);

            // Step 10: Mark webhook as processed
            updateWebhookStatus(webhookId, WebHookStatus.PROCESSED, null);
            return ResponseEntity.ok("Webhook processed successfully");

        } catch (Exception ex) {
            log.error("Unhandled error during Razorpay webhook processing", ex);
            if (webhookId != null) {
                updateWebhookStatus(webhookId, WebHookStatus.FAILED, ex.getMessage());
            }
            return ResponseEntity.status(500).body("Internal server error");
        }
    }

    /**
     * Handles different Razorpay event types
     */
    private void handleRazorpayEvent(String eventType, String orderId, String instituteId, 
                                     JsonNode paymentEntity) {
        switch (eventType) {
            case "payment.captured":
                log.info("Payment captured for orderId: {}", orderId);
                
                // Extract and save payment method token for recurring payments
                extractAndSavePaymentMethod(orderId, instituteId, paymentEntity);
                
                // Update payment status
                paymentLogService.updatePaymentLog(orderId, PaymentStatusEnum.PAID.name(), instituteId);
                break;

            case "payment.failed":
                log.warn("Payment failed for orderId: {}", orderId);
                paymentLogService.updatePaymentLog(orderId, PaymentStatusEnum.FAILED.name(), instituteId);
                break;

            case "payment.authorized":
                log.info("Payment authorized (pending capture) for orderId: {}", orderId);
                paymentLogService.updatePaymentLog(orderId, PaymentStatusEnum.PAYMENT_PENDING.name(), 
                        instituteId);
                break;

            case "order.paid":
                log.info("Order fully paid for orderId: {}", orderId);
                
                // Extract and save payment method token for recurring payments
                extractAndSavePaymentMethod(orderId, instituteId, paymentEntity);
                
                paymentLogService.updatePaymentLog(orderId, PaymentStatusEnum.PAID.name(), instituteId);
                break;

            default:
                log.info("Unhandled but valid event type: {}. Acknowledging.", eventType);
                break;
        }
    }

    /**
     * Updates webhook status in database
     */
    private void updateWebhookStatus(String webhookId, WebHookStatus status, String notes) {
        if (webhookId != null) {
            webHookService.updateWebHookStatus(webhookId, status, notes);
        }
    }

    /**
     * Extracts instituteId from payment notes in the payload
     */
    private String extractInstituteId(String payload) {
        try {
            JsonNode root = objectMapper.readTree(payload);
            JsonNode paymentEntity = extractPaymentEntity(root);
            
            if (paymentEntity != null) {
                JsonNode notesNode = paymentEntity.get("notes");
                if (notesNode != null && notesNode.has("instituteId")) {
                    return notesNode.get("instituteId").asText();
                }
            }

            // Fallback: Try to get from order notes if payment entity doesn't have it
            if (root.has("payload") && root.get("payload").has("order")) {
                JsonNode orderEntity = root.get("payload").get("order").get("entity");
                if (orderEntity != null) {
                    JsonNode notesNode = orderEntity.get("notes");
                    if (notesNode != null && notesNode.has("instituteId")) {
                        return notesNode.get("instituteId").asText();
                    }
                }
            }

        } catch (Exception e) {
            log.error("Failed to parse payload or extract instituteId", e);
        }
        return null;
    }

    /**
     * Extracts orderId from payment notes
     */
    private String extractOrderId(JsonNode paymentEntity) {
        try {
            JsonNode notesNode = paymentEntity.get("notes");
            if (notesNode != null && notesNode.has("orderId")) {
                return notesNode.get("orderId").asText();
            }
        } catch (Exception e) {
            log.error("Failed to extract orderId from payment entity", e);
        }
        return null;
    }

    /**
     * Extracts payment entity from webhook payload based on event type
     */
    private JsonNode extractPaymentEntity(JsonNode root) {
        try {
            // Check if payload contains payment entity
            if (root.has("payload") && root.get("payload").has("payment")) {
                return root.get("payload").get("payment").get("entity");
            }

            // Check if payload contains order entity
            if (root.has("payload") && root.get("payload").has("order")) {
                return root.get("payload").get("order").get("entity");
            }
        } catch (Exception e) {
            log.error("Failed to extract payment/order entity from payload", e);
        }
        return null;
    }

    /**
     * Retrieves webhook secret for the institute
     */
    private String getWebhookSecret(String instituteId) {
        Map<String, Object> gatewayData = institutePaymentGatewayMappingService
                .findInstitutePaymentGatewaySpecifData(PaymentGateway.RAZORPAY.name(), instituteId);
        return gatewayData != null ? (String) gatewayData.get("webhookSecret") : null;
    }

    /**
     * Verifies Razorpay webhook signature using HMAC SHA256
     * 
     * Razorpay signature format: hmac_sha256(webhook_secret, webhook_body)
     */
    private boolean verifySignature(String payload, String receivedSignature, String webhookSecret) {
        try {
            // Create HMAC SHA256 signature
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKeySpec = new SecretKeySpec(
                    webhookSecret.getBytes(StandardCharsets.UTF_8), 
                    "HmacSHA256"
            );
            mac.init(secretKeySpec);

            byte[] hash = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            
            // Convert to hex string
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            
            String expectedSignature = hexString.toString();
            
            log.debug("Expected signature: {}", expectedSignature);
            log.debug("Received signature: {}", receivedSignature);

            // Compare signatures (constant time comparison to prevent timing attacks)
            return MessageDigestEquals(expectedSignature, receivedSignature);

        } catch (Exception e) {
            log.error("Error verifying Razorpay signature", e);
            return false;
        }
    }

    /**
     * Constant time string comparison to prevent timing attacks
     */
    private boolean MessageDigestEquals(String a, String b) {
        if (a == null || b == null || a.length() != b.length()) {
            return false;
        }
        
        int result = 0;
        for (int i = 0; i < a.length(); i++) {
            result |= a.charAt(i) ^ b.charAt(i);
        }
        return result == 0;
    }

    private void extractAndSavePaymentMethod(String orderId, String instituteId, JsonNode paymentEntity) {
        try {
            // Step 1: Check if token_id exists in webhook
            if (!paymentEntity.has("token_id") || paymentEntity.get("token_id").isNull()) {
                log.debug("No token_id in webhook for orderId: {}. " +
                         "This is normal for non-recurring payments.", orderId);
                return;
            }

            String tokenId = paymentEntity.get("token_id").asText();
            log.info("Found token_id in webhook: {} for orderId: {}", tokenId, orderId);

            // Step 2: Get user ID from payment_log
            String userId = getUserIdFromPaymentLog(orderId);
            if (userId == null) {
                log.error("Cannot find userId for orderId: {}. Cannot save token.", orderId);
                return;
            }

            // Step 3: Get customer ID from webhook (optional, for validation)
            String customerId = paymentEntity.has("customer_id") ? 
                paymentEntity.get("customer_id").asText() : null;
            
            if (customerId != null) {
                log.debug("Customer ID from webhook: {}", customerId);
            }

            // Step 4: Extract card details (optional, for display purposes)
            String cardLast4 = null;
            String cardBrand = null;
            String paymentMethodType = "card"; // Default

            if (paymentEntity.has("card") && !paymentEntity.get("card").isNull()) {
                JsonNode cardNode = paymentEntity.get("card");
                cardLast4 = cardNode.has("last4") ? cardNode.get("last4").asText() : null;
                cardBrand = cardNode.has("network") ? cardNode.get("network").asText() : null;
                
                log.debug("Card details - Last4: {}, Brand: {}", cardLast4, cardBrand);
            }

            // Get payment method type from webhook if available
            if (paymentEntity.has("method")) {
                paymentMethodType = paymentEntity.get("method").asText();
            }

            // Step 5: Save token to database (in existing JSON column)
            userInstitutePaymentGatewayMappingService.savePaymentMethodInCustomerData(
                userId,
                instituteId,
                PaymentGateway.RAZORPAY.name(),
                tokenId,
                paymentMethodType,
                cardLast4,
                cardBrand
            );

            log.info("Successfully saved Razorpay payment method for user: {} " +
                    "with token: {}", userId, tokenId);

        } catch (Exception e) {
            // Don't fail the webhook if token save fails
            // Payment is already successful, token storage is just for future use
            log.error("Failed to extract/save payment method for orderId: {}. " +
                     "Payment processing will continue, but recurring payments may not work.", 
                     orderId, e);
        }
    }

    /**
     * Retrieves userId from payment_log table using order ID.
     * 
     * @param orderId Payment log order ID
     * @return User ID or null if not found
     */
    private String getUserIdFromPaymentLog(String orderId) {
        try {
            Optional<PaymentLog> paymentLogOptional = paymentLogRepository.findById(orderId);
            
            if (paymentLogOptional.isPresent()) {
                String userId = paymentLogOptional.get().getUserId();
                log.debug("Found userId: {} for orderId: {}", userId, orderId);
                return userId;
            } else {
                log.warn("PaymentLog not found for orderId: {}", orderId);
                return null;
            }
        } catch (Exception e) {
            log.error("Error retrieving userId from payment_log for orderId: {}", orderId, e);
            return null;
        }
    }
}


