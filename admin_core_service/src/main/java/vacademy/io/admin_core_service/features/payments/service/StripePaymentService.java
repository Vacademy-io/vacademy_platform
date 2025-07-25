package vacademy.io.admin_core_service.features.payments.service;

import org.springframework.stereotype.Service;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;
import vacademy.io.common.payment.dto.PaymentResponseDTO;

import java.util.Map;

@Service
public class StripePaymentService implements PaymentServiceStrategy {
    @Override
    public PaymentResponseDTO initiatePayment(PaymentInitiationRequestDTO request, Map<String, Object> paymentGatewaySpecificData) {
        return null;
    }
}
