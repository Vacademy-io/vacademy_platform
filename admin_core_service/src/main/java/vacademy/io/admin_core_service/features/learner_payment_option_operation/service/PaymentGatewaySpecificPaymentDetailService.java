package vacademy.io.admin_core_service.features.learner_payment_option_operation.service;

import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserInstitutePaymentGatewayMapping;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;
import vacademy.io.common.payment.enums.PaymentGateway;

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

            default:
                throw new IllegalStateException("Unexpected value: " + vendor);
        }
    }
}
