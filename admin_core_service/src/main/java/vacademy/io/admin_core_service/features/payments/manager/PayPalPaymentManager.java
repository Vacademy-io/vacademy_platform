package vacademy.io.admin_core_service.features.payments.service;

import org.springframework.stereotype.Service;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;
import vacademy.io.common.payment.dto.PaymentResponseDTO;

import java.util.Map;

@Service
public class PayPalPaymentService implements PaymentServiceStrategy {

    @Override
    public PaymentResponseDTO initiatePayment(UserDTO user, PaymentInitiationRequestDTO request, Map<String, Object> paymentGatewaySpecificData) {
        return null;
    }

    @Override
    public Map<String, Object> createCustomer(UserDTO user, PaymentInitiationRequestDTO request, Map<String, Object> paymentGatewaySpecificData) {
        return null;
    }
}
