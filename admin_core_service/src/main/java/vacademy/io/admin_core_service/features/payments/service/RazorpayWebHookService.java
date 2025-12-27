package vacademy.io.admin_core_service.features.payments.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.common.util.JsonUtil;
import vacademy.io.admin_core_service.features.institute.service.InstitutePaymentGatewayMappingService;
import vacademy.io.admin_core_service.features.payments.enums.WebHookStatus;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentLog;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentLogRepository;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentLogService;
import vacademy.io.admin_core_service.features.user_subscription.service.UserInstitutePaymentGatewayMappingService;
import vacademy.io.common.payment.enums.PaymentGateway;
import vacademy.io.common.payment.enums.PaymentStatusEnum;
import vacademy.io.common.logging.SentryLogger;
import org.json.JSONArray;
import org.json.JSONObject;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
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
                SentryLogger.logError(new IllegalStateException("Webhook secret not found"),
                        "Razorpay webhook secret not configured", Map.of(
                                "payment.vendor", "RAZORPAY",
                                "institute.id", instituteId,
                                "webhook.id", webhookId,
                                "operation", "getWebhookSecret"));
                updateWebhookStatus(webhookId, WebHookStatus.FAILED, "Webhook secret not found");
                return ResponseEntity.status(404).body("Unknown institute");
            }

            // Step 4: Verify webhook signature
            if (!verifySignature(payload, signature, webhookSecret)) {
                log.error("Webhook signature verification failed for institute: {}", instituteId);
                SentryLogger.logError(new SecurityException("Webhook signature verification failed"),
                        "Razorpay webhook signature verification failed", Map.of(
                                "payment.vendor", "RAZORPAY",
                                "institute.id", instituteId,
                                "webhook.id", webhookId,
                                "operation", "verifyWebhookSignature"));
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
                SentryLogger.logError(new IllegalStateException("Missing orderId in payment notes"),
                        "Razorpay webhook missing orderId in payment notes", Map.of(
                                "payment.vendor", "RAZORPAY",
                                "payment.id", paymentEntity.has("id") ? paymentEntity.get("id").asText() : "unknown",
                                "institute.id", instituteId,
                                "webhook.id", webhookId != null ? webhookId : "unknown",
                                "payment.webhook.event", eventType,
                                "operation", "extractOrderId"));
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
            SentryLogger.SentryEventBuilder.error(ex)
                    .withMessage("Razorpay webhook processing failed with unhandled error")
                    .withTag("payment.vendor", "RAZORPAY")
                    .withTag("webhook.id", webhookId != null ? webhookId : "unknown")
                    .withTag("operation", "processRazorpayWebhook")
                    .send();
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

                generateAndStoreRazorpayInvoice(orderId, instituteId, paymentEntity);
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

                extractAndSavePaymentMethod(orderId, instituteId, paymentEntity);

                generateAndStoreRazorpayInvoice(orderId, instituteId, paymentEntity);

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
            SentryLogger.logError(e, "Failed to parse Razorpay webhook payload", Map.of(
                    "payment.vendor", "RAZORPAY",
                    "operation", "extractInstituteId"));
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
            SentryLogger.logError(e, "Failed to extract orderId from Razorpay payment entity", Map.of(
                    "payment.vendor", "RAZORPAY",
                    "operation", "extractOrderId"));
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
            SentryLogger.logError(e, "Failed to extract payment entity from Razorpay webhook", Map.of(
                    "payment.vendor", "RAZORPAY",
                    "operation", "extractPaymentEntity"));
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
                    "HmacSHA256");
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
            SentryLogger.logError(e, "Error verifying Razorpay signature", Map.of(
                    "payment.vendor", "RAZORPAY",
                    "operation", "verifySignature"));
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
                SentryLogger.logError(new IllegalStateException("UserId not found for payment"),
                        "Cannot save Razorpay payment method - userId not found", Map.of(
                                "payment.vendor", "RAZORPAY",
                                "order.id", orderId,
                                "razorpay.token.id", tokenId,
                                "operation", "savePaymentMethod"));
                return;
            }

            // Step 3: Get customer ID from webhook (optional, for validation)
            String customerId = paymentEntity.has("customer_id") ? paymentEntity.get("customer_id").asText() : null;

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
                    cardBrand);

            log.info("Successfully saved Razorpay payment method for user: {} " +
                    "with token: {}", userId, tokenId);

        } catch (Exception e) {
            // Don't fail the webhook if token save fails
            // Payment is already successful, token storage is just for future use
            log.error("Failed to extract/save payment method for orderId: {}. " +
                    "Payment processing will continue, but recurring payments may not work.",
                    orderId, e);
            SentryLogger.SentryEventBuilder.error(e)
                    .withMessage("Failed to save Razorpay payment method")
                    .withTag("payment.vendor", "RAZORPAY")
                    .withTag("order.id", orderId)
                    .withTag("institute.id", instituteId)
                    .withTag("operation", "extractAndSavePaymentMethod")
                    .send();
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
            SentryLogger.logError(e, "Error retrieving userId from payment log", Map.of(
                    "payment.vendor", "RAZORPAY",
                    "order.id", orderId,
                    "operation", "getUserIdFromPaymentLog"));
            return null;
        }
    }

    private void generateAndStoreRazorpayInvoice(String orderId, String instituteId, JsonNode paymentEntity) {
        try {
            log.info("Generating Razorpay invoice for orderId: {}", orderId);

            // Step 1: Generate invoice via Razorpay API
            String invoiceUrl = generateRazorpayInvoice(orderId, instituteId, paymentEntity);

            if (invoiceUrl == null) {
                log.warn("Failed to generate Razorpay invoice for orderId: {}. " +
                        "Email will be sent without receipt URL.", orderId);
                return;
            }

            // Step 2: Store invoice URL in payment_specific_data
            storeInvoiceUrl(orderId, invoiceUrl);

            log.info("Successfully generated and stored Razorpay invoice URL for orderId: {}", orderId);

        } catch (Exception e) {
            // Don't fail the webhook if invoice generation fails
            // Payment is already successful, invoice is just for user convenience
            log.error("Error generating/storing Razorpay invoice for orderId: {}. " +
                    "Payment confirmation will continue without receipt URL.", orderId, e);
            SentryLogger.SentryEventBuilder.error(e)
                    .withMessage("Error generating or storing Razorpay invoice")
                    .withTag("payment.vendor", "RAZORPAY")
                    .withTag("order.id", orderId)
                    .withTag("institute.id", instituteId)
                    .withTag("operation", "generateAndStoreRazorpayInvoice")
                    .send();
        }
    }

    private String generateRazorpayInvoice(String orderId, String instituteId, JsonNode paymentEntity) {
        try {
            // Extract payment details from webhook
            String paymentId = paymentEntity.has("id") ? paymentEntity.get("id").asText() : null;
            long amount = paymentEntity.has("amount") ? paymentEntity.get("amount").asLong() : 0;
            String currency = paymentEntity.has("currency") ? paymentEntity.get("currency").asText() : "INR";
            String customerId = paymentEntity.has("customer_id") ? paymentEntity.get("customer_id").asText() : null;
            String email = paymentEntity.has("email") ? paymentEntity.get("email").asText() : null;
            String contact = paymentEntity.has("contact") ? paymentEntity.get("contact").asText() : null;

            // Validate required fields
            if (paymentId == null || amount == 0) {
                log.error("Missing required payment details for invoice generation. PaymentId: {}, Amount: {}",
                        paymentId, amount);
                SentryLogger.logError(new IllegalStateException("Missing payment details for invoice"),
                        "Missing required Razorpay payment details for invoice generation", Map.of(
                                "payment.vendor", "RAZORPAY",
                                "order.id", orderId,
                                "payment.id", paymentId != null ? paymentId : "unknown",
                                "payment.amount", String.valueOf(amount),
                                "operation", "generateRazorpayInvoice"));
                return null;
            }

            // Get Razorpay credentials
            Map<String, Object> gatewayData = institutePaymentGatewayMappingService
                    .findInstitutePaymentGatewaySpecifData(PaymentGateway.RAZORPAY.name(), instituteId);

            if (gatewayData == null) {
                log.error("Razorpay gateway data not found for institute: {}", instituteId);
                SentryLogger.logError(new IllegalStateException("Gateway data not found"),
                        "Razorpay gateway data not configured for institute", Map.of(
                                "payment.vendor", "RAZORPAY",
                                "institute.id", instituteId,
                                "order.id", orderId,
                                "operation", "getRazorpayCredentials"));
                return null;
            }

            // Try multiple field name variations for compatibility
            String razorpayKeyId = (String) gatewayData.get("apiKey");
            if (razorpayKeyId == null) {
                razorpayKeyId = (String) gatewayData.get("keyId");
            }

            // Check for secret in multiple field names (publishableKey, apiSecret,
            // keySecret)
            String razorpayKeySecret = (String) gatewayData.get("publishableKey");
            if (razorpayKeySecret == null) {
                razorpayKeySecret = (String) gatewayData.get("apiSecret");
            }
            if (razorpayKeySecret == null) {
                razorpayKeySecret = (String) gatewayData.get("keySecret");
            }

            if (razorpayKeyId == null || razorpayKeySecret == null) {
                log.error("Razorpay credentials not found for institute: {}. Gateway data keys: {}",
                        instituteId, gatewayData != null ? gatewayData.keySet() : "null");
                SentryLogger.logError(new IllegalStateException("Razorpay credentials not configured"),
                        "Razorpay API credentials not found", Map.of(
                                "payment.vendor", "RAZORPAY",
                                "institute.id", instituteId,
                                "order.id", orderId,
                                "has.keyId", String.valueOf(razorpayKeyId != null),
                                "has.keySecret", String.valueOf(razorpayKeySecret != null),
                                "operation", "getRazorpayApiCredentials"));
                return null;
            }

            log.debug("Retrieved Razorpay credentials for invoice generation. KeyId: {}", razorpayKeyId);

            // Build invoice request
            JSONObject invoiceRequest = new JSONObject();
            invoiceRequest.put("type", "invoice");
            invoiceRequest.put("description", "Payment Receipt - Course Enrollment");
            invoiceRequest.put("currency", currency);

            // Add customer ID if available
            if (customerId != null) {
                invoiceRequest.put("customer_id", customerId);
            } else {
                // Create customer inline if no customer_id
                JSONObject customer = new JSONObject();
                if (email != null)
                    customer.put("email", email);
                if (contact != null)
                    customer.put("contact", contact);
                customer.put("name", email != null ? email.split("@")[0] : "Customer");
                invoiceRequest.put("customer", customer);
            }

            // Add line items
            JSONArray lineItems = new JSONArray();
            JSONObject lineItem = new JSONObject();
            lineItem.put("name", "Course Enrollment Payment");
            lineItem.put("description", "Payment ID: " + paymentId);
            lineItem.put("amount", amount);
            lineItem.put("currency", currency);
            lineItem.put("quantity", 1);
            lineItems.put(lineItem);
            invoiceRequest.put("line_items", lineItems);

            // Don't send Razorpay's email/SMS (we'll send our own)
            invoiceRequest.put("email_notify", 0);
            invoiceRequest.put("sms_notify", 0);

            // Add reference to payment
            JSONObject notes = new JSONObject();
            notes.put("payment_id", paymentId);
            notes.put("order_id", orderId);
            invoiceRequest.put("notes", notes);

            log.debug("Razorpay invoice request: {}", invoiceRequest.toString());

            // Make API call to Razorpay
            String invoiceApiUrl = "https://api.razorpay.com/v1/invoices";
            String authString = razorpayKeyId + ":" + razorpayKeySecret;
            String encodedAuth = Base64.getEncoder().encodeToString(authString.getBytes(StandardCharsets.UTF_8));

            HttpClient client = HttpClient.newHttpClient();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(invoiceApiUrl))
                    .header("Authorization", "Basic " + encodedAuth)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(invoiceRequest.toString()))
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200 || response.statusCode() == 201) {
                JSONObject invoiceResponse = new JSONObject(response.body());

                // Extract invoice URLs
                String shortUrl = invoiceResponse.has("short_url") ? invoiceResponse.getString("short_url") : null;
                String invoiceId = invoiceResponse.has("id") ? invoiceResponse.getString("id") : null;

                log.info("Razorpay invoice created successfully. Invoice ID: {}, URL: {}", invoiceId, shortUrl);

                return shortUrl;
            } else {
                log.error("Failed to generate Razorpay invoice. Status: {}, Response: {}",
                        response.statusCode(), response.body());
                SentryLogger.SentryEventBuilder.error(new RuntimeException("Razorpay invoice API failed"))
                        .withMessage("Failed to generate Razorpay invoice via API")
                        .withTag("payment.vendor", "RAZORPAY")
                        .withTag("order.id", orderId)
                        .withTag("institute.id", instituteId)
                        .withTag("razorpay.api.status", String.valueOf(response.statusCode()))
                        .withTag("operation", "callRazorpayInvoiceAPI")
                        .send();
                return null;
            }

        } catch (Exception e) {
            log.error("Error calling Razorpay Invoice API for orderId: {}", orderId, e);
            SentryLogger.logError(e, "Exception calling Razorpay invoice API", Map.of(
                    "payment.vendor", "RAZORPAY",
                    "order.id", orderId,
                    "institute.id", instituteId != null ? instituteId : "unknown",
                    "operation", "generateRazorpayInvoice"));
            return null;
        }
    }

    private void storeInvoiceUrl(String orderId, String invoiceUrl) {
        if (invoiceUrl == null) {
            log.warn("No invoice URL to store for orderId: {}", orderId);
            return;
        }

        try {
            // Get existing payment log
            Optional<PaymentLog> paymentLogOptional = paymentLogRepository.findById(orderId);
            if (!paymentLogOptional.isPresent()) {
                log.error("Payment log not found for orderId: {}", orderId);
                SentryLogger.logError(new IllegalStateException("Payment log not found"),
                        "Payment log not found when storing Razorpay invoice URL", Map.of(
                                "payment.vendor", "RAZORPAY",
                                "order.id", orderId,
                                "operation", "storeInvoiceUrl"));
                return;
            }

            PaymentLog paymentLog = paymentLogOptional.get();

            // Parse existing payment_specific_data
            Map<String, Object> paymentData = JsonUtil.fromJson(
                    paymentLog.getPaymentSpecificData(),
                    Map.class);

            if (paymentData == null) {
                paymentData = new HashMap<>();
            }

            // Navigate to response.response_data (create if doesn't exist)
            Map<String, Object> response = (Map<String, Object>) paymentData.get("response");
            if (response == null) {
                response = new HashMap<>();
                paymentData.put("response", response);
            }

            Map<String, Object> responseData = (Map<String, Object>) response.get("response_data");
            if (responseData == null) {
                responseData = new HashMap<>();
                response.put("response_data", responseData);
            }

            // Add invoice URL (same field name as Stripe uses for consistency)
            responseData.put("receiptUrl", invoiceUrl);
            responseData.put("invoiceUrl", invoiceUrl); // Keep both for flexibility

            log.debug("Storing invoice URL in payment_specific_data: {}", invoiceUrl);

            // Save back to database
            paymentLog.setPaymentSpecificData(JsonUtil.toJson(paymentData));
            paymentLogRepository.save(paymentLog);

            log.info("Invoice URL stored successfully for orderId: {}", orderId);

        } catch (Exception e) {
            log.error("Error storing invoice URL in payment_specific_data for orderId: {}", orderId, e);
            SentryLogger.logError(e, "Error storing Razorpay invoice URL in payment log", Map.of(
                    "payment.vendor", "RAZORPAY",
                    "order.id", orderId,
                    "invoice.url", invoiceUrl != null ? invoiceUrl : "unknown",
                    "operation", "storeInvoiceUrl"));
        }
    }
}
