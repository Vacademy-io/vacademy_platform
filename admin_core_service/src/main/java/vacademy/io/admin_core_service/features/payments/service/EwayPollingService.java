package vacademy.io.admin_core_service.features.payments.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.payments.entity.WebHook;
import vacademy.io.common.payment.enums.PaymentType;
import vacademy.io.admin_core_service.features.enrollment_policy.service.RenewalPaymentService;
import vacademy.io.common.payment.enums.PaymentStatusEnum;
import vacademy.io.common.payment.dto.EwayWebHookDTO;
import vacademy.io.common.payment.dto.PaymentResponseDTO;
import org.springframework.util.StringUtils;

import java.util.Map;

@Service
@Slf4j
public class EwayPollingService {

    @Autowired
    private RenewalPaymentService renewalPaymentService;

    private void handleInitialPayment(EwayWebHookDTO webhookData, WebHook webhook) {
        // Existing webhook processing logic
    }

    private void handleRenewalPayment(EwayWebHookDTO webhookData, WebHook webhook) {
        try {
            PaymentResponseDTO paymentResponse = webhookData.getPaymentResponse();
            if (paymentResponse == null) {
                log.warn("No payment response found in renewal webhook");
                return;
            }

            String orderId = paymentResponse.getOrderId();
            String instituteId = webhookData.getInstituteId();
            Map<String, Object> responseData = paymentResponse.getResponseData();

            if (!StringUtils.hasText(orderId)) {
                log.warn("No orderId found in renewal payment webhook");
                return;
            }

            // Determine payment status from response data
            PaymentStatusEnum paymentStatus = PaymentStatusEnum.FAILED;
            if (responseData != null && responseData.containsKey("paymentStatus")) {
                String statusStr = (String) responseData.get("paymentStatus");
                paymentStatus = PaymentStatusEnum.valueOf(statusStr);
            }

            log.info("Processing Eway renewal payment: orderId={}, status={}", orderId, paymentStatus);

            // Call renewal service to handle payment confirmation
            renewalPaymentService.handleRenewalPaymentConfirmation(orderId, instituteId, paymentStatus, paymentResponse);

        } catch (Exception e) {
            log.error("Error processing Eway renewal payment webhook", e);
        }
    }
}