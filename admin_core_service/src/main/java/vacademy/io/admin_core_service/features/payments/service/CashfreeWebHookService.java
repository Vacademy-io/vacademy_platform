package vacademy.io.admin_core_service.features.payments.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.institute.service.InstitutePaymentGatewayMappingService;
import vacademy.io.admin_core_service.features.payments.enums.WebHookStatus;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentLogService;
import vacademy.io.common.payment.enums.PaymentGateway;
import vacademy.io.common.payment.enums.PaymentStatusEnum;

/**
 * Webhook handler for Cashfree payments.
 *
 * The goal is to mirror the behavior of {@link StripeWebHookService} and
 * {@link PhonePeWebHookService}:
 *  - Persist the incoming webhook
 *  - Resolve instituteId and our internal orderId (PaymentLog.id)
 *  - Map Cashfree order/payment status to PaymentStatusEnum
 *  - Update PaymentLog(s) and trigger post-payment logic
 */
@Slf4j
@Service
public class CashfreeWebHookService {

    @Autowired
    private InstitutePaymentGatewayMappingService institutePaymentGatewayMappingService;

    @Autowired
    private WebHookService webHookService;

    @Autowired
    private PaymentLogService paymentLogService;

    @Autowired
    private ObjectMapper objectMapper;

    /**
     * Process Cashfree webhook callbacks.
     *
     * @param payload          Raw JSON sent by Cashfree
     * @param signatureHeader  Signature header (name depends on Cashfree config)
     * @param instituteIdParam Optional instituteId from query param
     */
    public ResponseEntity<String> processWebHook(String payload,
                                                 String signatureHeader,
                                                 String instituteIdParam) {
        log.info("Received Cashfree webhook payload.");
        String webhookId = null;

        try {
            // Step 1: Save webhook for audit
            webhookId = webHookService.saveWebhook(PaymentGateway.CASHFREE.name(), payload, null);

            // Step 2: Parse payload
            JsonNode root = objectMapper.readTree(payload);
            JsonNode dataNode = root.path("data");

            // Cashfree payment webhooks (latest): status is in data.payment.payment_status ("SUCCESS" = PAID).
            // Older or order-level webhooks may use data.order.order_status. We support both.
            // See: https://www.cashfree.com/docs/api-reference/payments/latest/payments/webhooks
            JsonNode orderNode = dataNode.path("order");
            String orderId = StringUtils.hasText(orderNode.path("order_id").asText(null))
                    ? orderNode.path("order_id").asText(null)
                    : orderNode.path("orderId").asText(null);
            JsonNode paymentNode = dataNode.path("payment");
            String paymentStatus = paymentNode.isMissingNode() ? null : paymentNode.path("payment_status").asText(null);
            String orderStatus = orderNode.path("order_status").asText(null);
            // Prefer payment_status (SUCCESS/FAILED); fall back to order_status (PAID/FAILED)
            String status = StringUtils.hasText(paymentStatus) ? paymentStatus : orderStatus;
            String eventType = root.path("type").asText(null);
            if (!StringUtils.hasText(status) && StringUtils.hasText(eventType)) {
                String upper = eventType.trim().toUpperCase();
                if (upper.contains("SUCCESS") || upper.contains("PAID") || "ORDER_PAID".equals(upper)
                        || "PAYMENT_SUCCESS".equals(upper) || "PAYMENT_SUCCESS_WEBHOOK".equals(upper)) {
                    status = "SUCCESS";
                } else if (upper.contains("FAILED") || upper.contains("CANCELLED")) {
                    status = "FAILED";
                }
            }

            if (!StringUtils.hasText(orderId)) {
                log.error("Cashfree webhook missing order_id. Payload: {}", payload);
                webHookService.updateWebHookStatus(webhookId, WebHookStatus.FAILED, "Missing order_id");
                return ResponseEntity.badRequest().body("Missing order_id");
            }

            // Step 3: Resolve instituteId
            String instituteId = instituteIdParam;
            if (!StringUtils.hasText(instituteId)) {
                JsonNode tagsNode = orderNode.path("order_tags");
                if (tagsNode.isObject()) {
                    instituteId = tagsNode.path("instituteId").asText(null);
                }
            }

            if (!StringUtils.hasText(instituteId)) {
                log.warn("Cashfree webhook could not resolve instituteId for orderId={}", orderId);
                webHookService.updateWebHookStatus(webhookId, WebHookStatus.FAILED, "Missing instituteId");
                return ResponseEntity.badRequest().body("Missing instituteId");
            }

            log.info("Processing Cashfree webhook for instituteId: {}, orderId: {}, status: {} (payment_status={}, order_status={}, eventType={})",
                    instituteId, orderId, status, paymentStatus, orderStatus, eventType);
            if (log.isDebugEnabled()) {
                log.debug("Cashfree webhook payload snippet: {}", payload.length() > 800 ? payload.substring(0, 800) + "..." : payload);
            }

            // TODO: Implement signature verification using institute-specific secret when needed.
            // Map<String, Object> gatewayData =
            //         institutePaymentGatewayMappingService.findInstitutePaymentGatewaySpecifData(
            //                 PaymentGateway.CASHFREE.name(), instituteId);
            // String webhookSecret = (String) gatewayData.get("webhookSecret");
            // verifySignature(payload, signatureHeader, webhookSecret);

            // Step 4: Map Cashfree status to internal PaymentStatusEnum (SUCCESS/PAID -> PAID, FAILED -> FAILED)
            PaymentStatusEnum mappedStatus = mapStatus(status);

            // Step 5: Update payment logs
            if (mappedStatus == PaymentStatusEnum.PAID || mappedStatus == PaymentStatusEnum.FAILED) {
                paymentLogService.updatePaymentLogsByOrderId(orderId, mappedStatus.name(), instituteId);
                log.info("Cashfree webhook updated payment log(s) for orderId={} to {}", orderId, mappedStatus.name());
            } else {
                log.info("Cashfree status {} treated as PAYMENT_PENDING for orderId={} (no update)", status, orderId);
            }

            // Step 6: Mark webhook as processed
            webHookService.updateWebHook(webhookId, payload, orderId, root.path("type").asText(null));
            webHookService.updateWebHookStatus(webhookId, WebHookStatus.PROCESSED, null);

            return ResponseEntity.ok("SUCCESS");

        } catch (Exception e) {
            log.error("Error processing Cashfree webhook: {}", e.getMessage(), e);
            if (webhookId != null) {
                webHookService.updateWebHookStatus(webhookId, WebHookStatus.FAILED, e.getMessage());
            }
            return ResponseEntity.status(500).body("Error processing webhook");
        }
    }

    private PaymentStatusEnum mapStatus(String orderStatus) {
        if (!StringUtils.hasText(orderStatus)) {
            return PaymentStatusEnum.PAYMENT_PENDING;
        }
        String normalized = orderStatus.trim().toUpperCase();
        if ("PAID".equals(normalized) || "SUCCESS".equals(normalized)) {
            return PaymentStatusEnum.PAID;
        }
        if ("FAILED".equals(normalized) || "CANCELLED".equals(normalized) || "CANCELED".equals(normalized)) {
            return PaymentStatusEnum.FAILED;
        }
        return PaymentStatusEnum.PAYMENT_PENDING;
    }
}

