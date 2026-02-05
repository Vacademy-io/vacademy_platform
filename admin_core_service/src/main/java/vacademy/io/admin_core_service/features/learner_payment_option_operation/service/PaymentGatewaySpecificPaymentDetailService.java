package vacademy.io.admin_core_service.features.learner_payment_option_operation.service;

import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserInstitutePaymentGatewayMapping;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;
import vacademy.io.common.payment.enums.PaymentGateway;

import java.util.Map;

@Service
public class PaymentGatewaySpecificPaymentDetailService {

    public void configureCustomerPaymentData(UserInstitutePaymentGatewayMapping userInstitutePaymentGatewayMapping,
            String vendor,
            PaymentInitiationRequestDTO paymentInitiationRequestDTO) {
        PaymentGateway paymentGateway = PaymentGateway.fromString(vendor);

        switch (paymentGateway) {
            case STRIPE:
                if (paymentInitiationRequestDTO.getStripeRequest() != null) {
                    paymentInitiationRequestDTO.getStripeRequest()
                            .setCustomerId(userInstitutePaymentGatewayMapping.getPaymentGatewayCustomerId());
                }
                break;
            case RAZORPAY:
                if (paymentInitiationRequestDTO.getRazorpayRequest() != null) {
                    paymentInitiationRequestDTO.getRazorpayRequest()
                            .setCustomerId(userInstitutePaymentGatewayMapping.getPaymentGatewayCustomerId());
                }
                break;
            case EWAY:
                if (paymentInitiationRequestDTO.getEwayRequest() != null) {
                    paymentInitiationRequestDTO.getEwayRequest()
                            .setCustomerId(userInstitutePaymentGatewayMapping.getPaymentGatewayCustomerId());
                }
                break;
            case PHONEPE:
                break;
            default:
                throw new IllegalStateException("Unexpected value: " + vendor);
        }
    }

    public void configureCustomerPaymentData(Map<String, Object> userInstitutePaymentGatewayMapping,
            String vendor,
            PaymentInitiationRequestDTO paymentInitiationRequestDTO) {
        PaymentGateway paymentGateway = PaymentGateway.fromString(vendor);

        switch (paymentGateway) {
            case STRIPE:
                if (paymentInitiationRequestDTO.getStripeRequest() != null) {
                    paymentInitiationRequestDTO.getStripeRequest()
                            .setCustomerId((String) userInstitutePaymentGatewayMapping.get("customerId"));
                }
                break;
            case RAZORPAY:
                if (paymentInitiationRequestDTO.getRazorpayRequest() != null) {
                    paymentInitiationRequestDTO.getRazorpayRequest()
                            .setCustomerId((String) userInstitutePaymentGatewayMapping.get("customerId"));
                }
                break;
            case EWAY:
                if (paymentInitiationRequestDTO.getEwayRequest() != null) {
                    paymentInitiationRequestDTO.getEwayRequest()
                            .setCustomerId((String) userInstitutePaymentGatewayMapping.get("customerId"));
                }
                break;
            case PHONEPE:
                break;

            default:
                throw new IllegalStateException("Unexpected value: " + vendor);
        }
    }
}
