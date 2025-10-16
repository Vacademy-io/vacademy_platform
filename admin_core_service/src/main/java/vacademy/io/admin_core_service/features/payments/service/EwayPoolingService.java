package vacademy.io.admin_core_service.features.payments.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.institute.service.InstitutePaymentGatewayMappingService;
import vacademy.io.admin_core_service.features.payments.entity.WebHook;
import vacademy.io.admin_core_service.features.payments.enums.WebHookStatus;
import vacademy.io.admin_core_service.features.payments.manager.EwayPaymentManager;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentLogService;
import vacademy.io.common.payment.dto.EwayTransaction;
import vacademy.io.common.payment.dto.EwayWebHookDTO;
import vacademy.io.common.payment.dto.PaymentResponseDTO;
import vacademy.io.common.payment.enums.PaymentGateway;
import vacademy.io.common.payment.enums.PaymentStatusEnum;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class EwayPoolingService {

    private static final int POLLING_TIMEOUT_MINUTES = 30;

    @Autowired
    private WebHookService webHookService;
    @Autowired
    private PaymentLogService paymentLogService;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private EwayPaymentManager ewayPaymentManager;
    @Autowired
    private InstitutePaymentGatewayMappingService institutePaymentGatewayMappingService;

    /**
     * Scheduled task that runs every minute to poll for the status of pending Eway transactions.
     */
    @Scheduled(fixedRate = 60000) // Runs every 60 seconds
    public void pollPendingEwayTransactions() {
        log.info("Starting Eway polling job...");
        List<WebHook> pendingWebhooks = webHookService.getPendingWebHooks(PaymentGateway.EWAY.name());

        if (pendingWebhooks.isEmpty()) {
            log.info("No pending Eway webhooks to process.");
            return;
        }

        for (WebHook webhook : pendingWebhooks) {
            processSingleWebhook(webhook);
        }
        log.info("Eway polling job finished.");
    }

    /**
     * Processes a single pending webhook by calling the Eway API.
     *
     * @param webhook The parent webhook record.
     */
    private void processSingleWebhook(WebHook webhook) {
        String webhookId = webhook.getId();
        log.info("Polling status for Eway webhookId: {}", webhookId);
        String attemptNote;

        try {
            // Deserialize payload to get necessary IDs
            EwayWebHookDTO ewayWebHookDTO = objectMapper.readValue(webhook.getPayload(), EwayWebHookDTO.class);
            PaymentResponseDTO paymentResponse = ewayWebHookDTO.getPaymentResponse();
            String instituteId = ewayWebHookDTO.getInstituteId();
            String orderId = paymentResponse.getOrderId();
            String transactionId = (String) paymentResponse.getResponseData().get("transactionId");

            if (!StringUtils.hasText(transactionId)) {
                handleProcessingError(webhook, "TransactionID is missing from webhook payload.");
                return;
            }

            // Fetch Eway credentials for the specific institute
            Map<String, Object> credentials = institutePaymentGatewayMappingService.findInstitutePaymentGatewaySpecifData(PaymentGateway.EWAY.name(), instituteId);
            EwayTransaction transaction = ewayPaymentManager.getTransactionById(transactionId, credentials);

            if (transaction == null) {
                return;
            }

            // Analyze the transaction status
            if (transaction.getTransactionStatus()) {
                // SUCCESS
                log.info("Payment SUCCESS for orderId: {}. Marking webhook {} as PROCESSED.", orderId, webhookId);
                paymentLogService.updatePaymentLog(orderId, PaymentStatusEnum.PAID.name(), instituteId);
                webHookService.updateWebHookStatus(webhookId, WebHookStatus.PROCESSED, null);
            } else if (isDefinitiveFailure(transaction.getResponseMessage())) {
                // FAILURE
                paymentLogService.updatePaymentLog(orderId, PaymentStatusEnum.FAILED.name(), instituteId);
                webHookService.updateWebHookStatus(webhookId, WebHookStatus.PROCESSED, null);
            } else {
                // STILL PENDING
                log.info("Transaction for orderId: {} is still pending. Will re-poll.", orderId);
            }

        } catch (Exception ex) {
            log.error("Error processing Eway webhook with ID: {}", webhookId, ex);
            webHookService.updateWebHookStatus(webhookId, WebHookStatus.RECEIVED, ex.getMessage());

        }
    }

    /**
     * Marks a webhook as FAILED due to polling timeout.
     */
    private void handleTimeout(WebHook webhook) {
        log.warn("Eway webhookId: {} has timed out after {} minutes. Marking as FAILED.", webhook.getId(), POLLING_TIMEOUT_MINUTES);
        try {
            EwayWebHookDTO dto = objectMapper.readValue(webhook.getPayload(), EwayWebHookDTO.class);
            paymentLogService.updatePaymentLog(dto.getPaymentResponse().getOrderId(), PaymentStatusEnum.FAILED.name(), dto.getInstituteId());
            String finalNote = "Transaction timed out after " + POLLING_TIMEOUT_MINUTES + " minutes of polling.";
            webHookService.updateWebHookStatus(webhook.getId(), WebHookStatus.FAILED, finalNote);
        } catch (Exception e) {
            log.error("Failed to process timeout for webhookId: {}", webhook.getId(), e);
            webHookService.updateWebHookStatus(webhook.getId(), WebHookStatus.FAILED, "Webhook timed out, but failed to parse payload to update payment log.");
        }
    }

    /**
     * Handles fatal errors during webhook processing, like a malformed payload.
     */
    private void handleProcessingError(WebHook webhook, String errorMessage) {
        log.error("Cannot process webhookId {}: {}. Marking as FAILED.", webhook.getId(), errorMessage);
        webHookService.updateWebHookStatus(webhook.getId(), WebHookStatus.RECEIVED,errorMessage);
    }

    /**
     * Determines if an Eway response message indicates a permanent failure.
     * (This list may need to be expanded based on Eway documentation).
     */
    private boolean isDefinitiveFailure(String responseMessage) {
        if (responseMessage == null) return false;
        String msg = responseMessage.toLowerCase();
        return msg.contains("declined") || msg.contains("invalid") || msg.contains("expired");
    }
}
