package vacademy.io.admin_core_service.features.payments.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute.service.InstitutePaymentGatewayMappingService;
import vacademy.io.admin_core_service.features.payments.enums.WebHookStatus;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentLogService;
import vacademy.io.common.payment.dto.PhonePeWebHookDTO;
import vacademy.io.common.payment.enums.PaymentGateway;
import vacademy.io.common.payment.enums.PaymentStatusEnum;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;

@Slf4j
@Service
public class PhonePeWebHookService {

    @Autowired
    private InstitutePaymentGatewayMappingService institutePaymentGatewayMappingService;

    @Autowired
    private WebHookService webHookService;

    @Autowired
    private PaymentLogService paymentLogService;

    @Autowired
    private ObjectMapper objectMapper;

    public ResponseEntity<String> processWebHook(String payload, String authHeader, String instituteIdParam) {
        log.info("Received PhonePe webhook callback.");
        String webhookId = null;

        try {
            // Step 1: Parse payload
            // PhonePe sends { "response": "base64EncodedString" }
            com.fasterxml.jackson.databind.JsonNode rootNode = objectMapper.readTree(payload);

            String base64Response = "";
            if (rootNode.has("response")) {
                base64Response = rootNode.get("response").asText();
            } else {
                // Fallback or error if payload format is unexpected
                log.warn("PhonePe webhook missing 'response' field. Trying raw payload.");
                base64Response = payload; // Unlikely to work if it's not JSON, but defensive.
            }

            String decodedResponse;
            try {
                byte[] decodedBytes = java.util.Base64.getDecoder().decode(base64Response);
                decodedResponse = new String(decodedBytes, StandardCharsets.UTF_8);
                log.info("Decoded PhonePe Payload: {}", decodedResponse);
            } catch (IllegalArgumentException e) {
                // Not base64?
                log.warn("Failed to decode base64 response. Assuming raw JSON.");
                decodedResponse = base64Response;
            }

            com.fasterxml.jackson.databind.JsonNode decodedJson = objectMapper.readTree(decodedResponse);

            // Structure: { success: true, code: "PAYMENT_SUCCESS", data: {
            // merchantTransactionId: "...", ... } }
            String event = decodedJson.path("code").asText(); // e.g. PAYMENT_SUCCESS
            com.fasterxml.jackson.databind.JsonNode dataNode = decodedJson.path("data");

            String merchantOrderId = dataNode.path("merchantTransactionId").asText();
            if (merchantOrderId == null || merchantOrderId.isEmpty()) {
                // Try merchantOrderId (legacy?)
                merchantOrderId = dataNode.path("merchantOrderId").asText();
            }

            // Step 2: Save webhook for audit
            webhookId = webHookService.saveWebhook(PaymentGateway.PHONEPE.name(), payload, merchantOrderId);

            // Step 3: Extract instituteId - prioritize query parameter over metaInfo
            String instituteId = instituteIdParam; // From URL query parameter

            if (instituteId == null || instituteId.isEmpty()) {
                // Fallback: Try to get from metaInfo (udf1) if not in query param
                // In data -> paymentInstrument -> ... or data -> param1?
                // PhonePe standard S2S usually doesn't return metaInfo in the top level of
                // 'data' always.
                // It might be in 'data' directly if custom params were passed?
                // For now, let's check path("param1") or similar if used, but relying on query
                // param is best.
                instituteId = dataNode.path("param1").asText("");
            }

            if (instituteId == null || instituteId.isEmpty()) {
                log.error("Webhook missing instituteId. Cannot process payment update.");
                webHookService.updateWebHookStatus(webhookId, WebHookStatus.FAILED, "Missing instituteId");
                return ResponseEntity.status(400).body("Missing instituteId");
            }

            log.info("Processing PhonePe webhook for instituteId: {}, orderId: {}", instituteId, merchantOrderId);

            // Step 4: Verify Authorization
            // Note: PhonePe uses X-VERIFY. We should validate it eventually.
            // For now, we continue as requested.

            // Step 5: Handle events
            String state = dataNode.path("state").asText(); // e.g. COMPLETED
            if (state == null || state.isEmpty()) {
                state = dataNode.path("paymentState").asText();
            }

            handleEvent(event, merchantOrderId, state, instituteId);

            // Step 6: Mark as processed
            webHookService.updateWebHook(webhookId, payload, merchantOrderId, event);
            webHookService.updateWebHookStatus(webhookId, WebHookStatus.PROCESSED, null);

            return ResponseEntity.ok("SUCCESS");

        } catch (Exception e) {
            log.error("Error processing PhonePe webhook: {}", e.getMessage(), e);
            if (webhookId != null) {
                webHookService.updateWebHookStatus(webhookId, WebHookStatus.FAILED, e.getMessage());
            }
            return ResponseEntity.status(500).body("Error processing webhook");
        }
    }

    private void handleEvent(String event, String merchantOrderId, String state, String instituteId) {
        log.info("Handling PhonePe event: {} for order: {} with state: {}", event, merchantOrderId, state);

        try {
            // Map PhonePe codes to our status
            if ("PAYMENT_SUCCESS".equalsIgnoreCase(event) || "COMPLETED".equalsIgnoreCase(state)) {
                log.info("Payment completed for order: {}. Updating logs.", merchantOrderId);
                paymentLogService.updatePaymentLogsByOrderId(merchantOrderId, PaymentStatusEnum.PAID.name(),
                        instituteId);
            } else if ("PAYMENT_ERROR".equalsIgnoreCase(event) || "FAILED".equalsIgnoreCase(state)) {
                log.warn("Payment failed for order: {}. Updating logs.", merchantOrderId);
                paymentLogService.updatePaymentLogsByOrderId(merchantOrderId, PaymentStatusEnum.FAILED.name(),
                        instituteId);
            } else if ("PAYMENT_PENDING".equalsIgnoreCase(event) || "PENDING".equalsIgnoreCase(state)) {
                // PhonePe might send PENDING status, though we usually care about final ones.
                log.info("Payment pending for order: {}. Updating logs.", merchantOrderId);
                paymentLogService.updatePaymentLogsByOrderId(merchantOrderId, PaymentStatusEnum.PAYMENT_PENDING.name(),
                        instituteId);
            } else {
                log.info("Unhandled PhonePe state: {} / event: {}. No action taken.", state, event);
            }
        } catch (Exception e) {
            // Swallow logic errors here to not fail the webhook response
            log.error("Error in business logic for event {}; order {}: {}", event, merchantOrderId, e.getMessage(), e);
        }
    }

    private boolean verifyAuth(String authHeader, String instituteId) {
        if (authHeader == null || instituteId == null)
            return false;

        try {
            // Get credentials for this institute
            Map<String, Object> gatewayData = institutePaymentGatewayMappingService
                    .findInstitutePaymentGatewaySpecifData(PaymentGateway.PHONEPE.name(), instituteId);
            String username = (String) gatewayData.get("webhookUsername");
            String password = (String) gatewayData.get("webhookPassword");

            if (username == null || password == null) {
                log.error("PhonePe webhook credentials missing for institute: {}", instituteId);
                return false;
            }

            String input = username + ":" + password;
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] encodedhash = digest.digest(input.getBytes(StandardCharsets.UTF_8));

            String expectedAuth = bytesToHex(encodedhash);

            // Per doc: Authorization: SHA256(username:password)
            // Note: The doc says SHA256, but doesn't specify if it's hex or base64.
            // Usually it's hex for SHA256 headers like this.
            return authHeader.equalsIgnoreCase(expectedAuth);

        } catch (Exception e) {
            log.error("Error verifying PhonePe webhook auth", e);
            return false;
        }
    }

    private String bytesToHex(byte[] hash) {
        StringBuilder hexString = new StringBuilder(2 * hash.length);
        for (byte b : hash) {
            String hex = Integer.toHexString(0xff & b);
            if (hex.length() == 1) {
                hexString.append('0');
            }
            hexString.append(hex);
        }
        return hexString.toString();
    }
}
