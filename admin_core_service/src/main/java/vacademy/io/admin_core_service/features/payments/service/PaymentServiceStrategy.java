package vacademy.io.admin_core_service.features.payments.service;

import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;
import vacademy.io.common.payment.dto.PaymentResponseDTO;

import java.util.Map;

public interface PaymentServiceStrategy {
    PaymentResponseDTO initiatePayment(PaymentInitiationRequestDTO request, Map<String, Object> paymentGatewaySpecificData);
}
