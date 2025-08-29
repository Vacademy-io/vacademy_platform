package vacademy.io.admin_core_service.features.payments.manager;

import org.springframework.stereotype.Service;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;
import vacademy.io.common.payment.dto.PaymentResponseDTO;

import java.util.Map;

@Service
public class PayPalPaymentManager implements PaymentServiceStrategy {

    @Override
    public PaymentResponseDTO initiatePayment(UserDTO user, PaymentInitiationRequestDTO request,
            Map<String, Object> paymentGatewaySpecificData) {
        return null;
    }

    @Override
    public Map<String, Object> createCustomer(UserDTO user, PaymentInitiationRequestDTO request,
            Map<String, Object> paymentGatewaySpecificData) {
        return null;
    }

    @Override
    public Map<String, Object> createCustomerForUnknownUser(String email, PaymentInitiationRequestDTO request,
            Map<String, Object> paymentGatewaySpecificData) {
        // TODO: Implement PayPal customer creation for unknown users
        return null;
    }

    @Override
    public Map<String, Object> findCustomerByEmail(String email, Map<String, Object> paymentGatewaySpecificData) {
        // TODO: Implement PayPal customer search by email
        return null;
    }
}
