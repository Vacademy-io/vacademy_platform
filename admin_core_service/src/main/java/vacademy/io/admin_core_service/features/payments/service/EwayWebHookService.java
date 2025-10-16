package vacademy.io.admin_core_service.features.payments.service;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute.service.InstitutePaymentGatewayMappingService;
import vacademy.io.admin_core_service.features.payments.enums.WebHookStatus;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentLogService;
import vacademy.io.common.payment.enums.PaymentGateway;
import vacademy.io.common.payment.enums.PaymentStatusEnum;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.Map;

@Slf4j
@Service
public class EwayWebHookService {

    @Autowired
    private WebHookService webHookService;
    @Autowired
    private InstitutePaymentGatewayMappingService institutePaymentGatewayMappingService;
    @Autowired
    private PaymentLogService paymentLogService;
    @Autowired
    private ObjectMapper objectMapper;

    public ResponseEntity<String> processWebHook(String payload, String signature, String instituteId) {
        log.info("Received eWAY webhook for institute: {}", instituteId);
        String webhookId = null;

        try {
            // 1. Save the initial webhook payload for auditing
            webhookId = webHookService.saveWebhook(PaymentGateway.EWAY.name(), payload);

            // 2. Get the webhook secret key from the database for the specific institute
            String webhookSecret = getWebhookSecret(instituteId);
            if (webhookSecret == null) {
                log.error("eWAY webhook secret not found for institute: {}", instituteId);
                updateWebhookStatus(webhookId, WebHookStatus.FAILED, "Webhook secret not configured for institute.");
                return ResponseEntity.status(404).body("Configuration not found for institute.");
            }

            // 3. Verify the signature to ensure the webhook is from eWAY
            if (!verifySignature(payload, signature, webhookSecret)) {
                log.warn("Invalid eWAY webhook signature for institute: {}", instituteId);
                updateWebhookStatus(webhookId, WebHookStatus.FAILED, "Invalid signature.");
                return ResponseEntity.status(400).body("Invalid signature.");
            }
            log.info("eWAY webhook signature verified successfully.");

            // 4. Parse the payload into a usable object
            EwayWebhookPayload ewayPayload = objectMapper.readValue(payload, EwayWebhookPayload.class);

            // 5. Extract our internal orderId from the InvoiceReference field
            String orderId = ewayPayload.InvoiceReference;
            if (orderId == null) {
                log.error("Missing 'InvoiceReference' (orderId) in eWAY webhook payload.");
                updateWebhookStatus(webhookId, WebHookStatus.FAILED, "Missing InvoiceReference in payload.");
                return ResponseEntity.status(400).body("Missing order identifier.");
            }

            // Update the webhook record with the extracted orderId and event type
            String eventType = ewayPayload.TransactionStatus ? "payment.succeeded" : "payment.failed";
            webHookService.updateWebHook(webhookId, payload, orderId, eventType);


            // 6. Process the event
            if (ewayPayload.TransactionStatus) {
                log.info("eWAY payment succeeded for orderId: {}", orderId);
                paymentLogService.updatePaymentLog(orderId, PaymentStatusEnum.PAID.name(), instituteId);
            } else {
                log.warn("eWAY payment failed for orderId: {}. Reason: {}", orderId, ewayPayload.ResponseMessage);
                paymentLogService.updatePaymentLog(orderId, PaymentStatusEnum.FAILED.name(), instituteId);
            }

            updateWebhookStatus(webhookId, WebHookStatus.PROCESSED, null);
            return ResponseEntity.ok("Webhook processed successfully.");

        } catch (Exception ex) {
            log.error("Unhandled error during eWAY webhook processing", ex);
            if (webhookId != null) {
                updateWebhookStatus(webhookId, WebHookStatus.FAILED, ex.getMessage());
            }
            return ResponseEntity.status(500).body("Internal server error.");
        }
    }

    private String getWebhookSecret(String instituteId) {
        Map<String, Object> gatewayData = institutePaymentGatewayMappingService.findInstitutePaymentGatewaySpecifData(PaymentGateway.EWAY.name(), instituteId);
        return gatewayData != null ? (String) gatewayData.get("webhookSecret") : null;
    }

    private boolean verifySignature(String payload, String signature, String secret) {
        try {
            Mac sha256_HMAC = Mac.getInstance("HmacSHA256");
            SecretKeySpec secret_key = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            sha256_HMAC.init(secret_key);

            String hash = Base64.getEncoder().encodeToString(sha256_HMAC.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
            return hash.equals(signature);
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            log.error("Error during HMAC-SHA256 signature generation: {}", e.getMessage());
            return false;
        }
    }

    private void updateWebhookStatus(String webhookId, WebHookStatus status, String notes) {
        if (webhookId != null) {
            webHookService.updateWebHookStatus(webhookId, status, notes);
        }
    }

    // DTO class to represent the incoming eWAY webhook JSON payload
    private static class EwayWebhookPayload {
        @JsonProperty("TransactionID")
        public String TransactionID;
        @JsonProperty("TransactionStatus")
        public boolean TransactionStatus;
        @JsonProperty("ResponseMessage")
        public String ResponseMessage;
        @JsonProperty("InvoiceReference")
        public String InvoiceReference; // This is where we store our orderId
    }
}
