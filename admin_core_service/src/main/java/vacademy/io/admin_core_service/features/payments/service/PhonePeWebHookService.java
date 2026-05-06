package vacademy.io.admin_core_service.features.payments.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute.service.InstitutePaymentGatewayMappingService;
import vacademy.io.admin_core_service.features.payments.enums.WebHookStatus;
import vacademy.io.admin_core_service.features.payments.util.WebHookErrorUtils;
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
            // Step 2: Save webhook for audit (parse-failures will surface in catch with
            // descriptive message)
            webhookId = webHookService.saveWebhook(PaymentGateway.PHONEPE.name(), payload, null);

            // Step 4: Verify Authorization (skip for now as PhonePe doesn't send auth
            // header in standard flow). For production, implement proper signature check.
            log.debug(
                    "Skipping auth verification for PhonePe webhook (implement signature verification for production)");

            return processVerifiedPayload(webhookId, payload, instituteIdParam);

        } catch (Exception e) {
            String detailedMessage = WebHookErrorUtils.describeException(e);
            log.error("Error processing PhonePe webhook: {}", detailedMessage, e);
            if (webhookId != null) {
                webHookService.updateWebHookStatus(webhookId, WebHookStatus.FAILED, detailedMessage);
            }
            return ResponseEntity.status(500).body("Error processing webhook");
        }
    }

    /**
     * Manually re-runs a previously persisted PhonePe webhook by id. Auth check
     * for PhonePe is currently a no-op so reprocess simply re-runs the parsing
     * and event-handling pipeline.
     */
    public ResponseEntity<String> reprocessWebhook(String webhookId) {
        log.info("Manual reprocess requested for PhonePe webhookId={}", webhookId);

        var webhookOpt = webHookService.findById(webhookId);
        if (webhookOpt.isEmpty()) {
            return ResponseEntity.status(404).body("WebHook not found: " + webhookId);
        }
        var webhook = webhookOpt.get();

        if (!PaymentGateway.PHONEPE.name().equalsIgnoreCase(webhook.getVendor())) {
            return ResponseEntity.status(400)
                    .body("WebHook vendor is " + webhook.getVendor() + ", expected PHONEPE for this endpoint.");
        }

        String payload = webhook.getPayload();
        if (payload == null || payload.isBlank()) {
            webHookService.updateWebHookStatus(webhookId, WebHookStatus.FAILED,
                    "Stored payload is empty, cannot reprocess");
            return ResponseEntity.status(400).body("Stored payload is empty for webhook " + webhookId);
        }

        webHookService.resetForReprocess(webhookId);

        try {
            // instituteIdParam is null on reprocess — service will fall back to metaInfo.udf1
            return processVerifiedPayload(webhookId, payload, null);
        } catch (Exception e) {
            String detailedMessage = WebHookErrorUtils.describeException(e);
            log.error("Manual reprocess failed for PhonePe webhookId={}: {}", webhookId, detailedMessage, e);
            webHookService.updateWebHookStatus(webhookId, WebHookStatus.FAILED, detailedMessage);
            return ResponseEntity.status(500).body("Reprocess failed: " + detailedMessage);
        }
    }

    /**
     * Steps 1, 3, 5, 6 of the pipeline — payload parse, instituteId resolution,
     * event handling, and webhook-row finalization. Shared between live webhook
     * delivery (after no-op auth check) and manual reprocess.
     */
    private ResponseEntity<String> processVerifiedPayload(String webhookId, String payload, String instituteIdParam)
            throws Exception {
        // Step 1: Parse payload
        PhonePeWebHookDTO webhookDTO = objectMapper.readValue(payload, PhonePeWebHookDTO.class);
        String merchantOrderId = webhookDTO.getPayload().getMerchantOrderId();
        String event = webhookDTO.getEvent();

        // Step 3: Extract instituteId - prioritize query parameter over metaInfo
        String instituteId = instituteIdParam;

        if (instituteId == null || instituteId.isEmpty()) {
            // Fallback: Try to get from metaInfo (udf1) if not in query param
            instituteId = webhookDTO.getPayload().getMetaInfo() != null
                    ? webhookDTO.getPayload().getMetaInfo().get("udf1")
                    : null;
        }

        if (instituteId == null || instituteId.isEmpty()) {
            log.error("Webhook missing instituteId. Cannot process payment update.");
            webHookService.updateWebHookStatus(webhookId, WebHookStatus.FAILED, "Missing instituteId");
            return ResponseEntity.status(400).body("Missing instituteId");
        }

        log.info("Processing PhonePe webhook for instituteId: {}, orderId: {} (webhookId={})", instituteId,
                merchantOrderId, webhookId);

        // Step 5: Handle events
        handleEvent(webhookDTO, instituteId);

        // Step 6: Mark as processed
        webHookService.updateWebHook(webhookId, payload, merchantOrderId, event);
        webHookService.updateWebHookStatus(webhookId, WebHookStatus.PROCESSED, null);

        return ResponseEntity.ok("SUCCESS");
    }

    private void handleEvent(PhonePeWebHookDTO webhookDTO, String instituteId) {
        String event = webhookDTO.getEvent();
        String merchantOrderId = webhookDTO.getPayload().getMerchantOrderId();
        String state = webhookDTO.getPayload().getState();

        log.info("Handling PhonePe event: {} for order: {} with state: {}", event, merchantOrderId, state);

        if ("checkout.order.completed".equals(event) || "pg.order.completed".equals(event)
                || "COMPLETED".equalsIgnoreCase(state)) {
            log.info("Payment completed for order: {}", merchantOrderId);
            paymentLogService.updatePaymentLogsByOrderId(merchantOrderId, PaymentStatusEnum.PAID.name(), instituteId);
        } else if ("checkout.order.failed".equals(event) || "pg.order.failed".equals(event)
                || "FAILED".equalsIgnoreCase(state)) {
            log.warn("Payment failed for order: {}", merchantOrderId);
            paymentLogService.updatePaymentLogsByOrderId(merchantOrderId, PaymentStatusEnum.FAILED.name(), instituteId);
        } else if ("pg.refund.completed".equals(event)) {
            log.info("Refund completed for order: {}", merchantOrderId);
            // Implement refund status update if needed
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