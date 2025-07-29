package vacademy.io.admin_core_service.features.payments.manager;

import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;
import vacademy.io.common.payment.dto.PaymentResponseDTO;

import java.util.Map;

public interface PaymentServiceStrategy {
    PaymentResponseDTO initiatePayment(UserDTO user,PaymentInitiationRequestDTO request, Map<String, Object> paymentGatewaySpecificData);
    Map<String, Object> createCustomer(UserDTO user,PaymentInitiationRequestDTO request, Map<String, Object> paymentGatewaySpecificData);
}
