package vacademy.io.admin_core_service.features.learner_payment_option_operation.service;

import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.user_subscription.enums.PaymentOptionType;

import java.util.Map;


@Service
public class PaymentOptionOperationFactory {
    private final Map<PaymentOptionType,PaymentOptionOperationStrategy> strategies;

    public PaymentOptionOperationFactory(SubscriptionPaymentOptionOperation subscriptionPaymentOptionOperation,
                                         OneTimePaymentOptionOperation oneTimePaymentOptionOperation,
                                         DonationPaymentOptionOperation donationPaymentOptionOperation,
                                         FreePaymentOptionOperation freePaymentOptionOperation) {
        strategies = Map.of(
                PaymentOptionType.SUBSCRIPTION, subscriptionPaymentOptionOperation,
                PaymentOptionType.ONE_TIME, oneTimePaymentOptionOperation,
                PaymentOptionType.DONATION, donationPaymentOptionOperation,
                PaymentOptionType.FREE, freePaymentOptionOperation
        );
    }

    public PaymentOptionOperationStrategy getStrategy(PaymentOptionType paymentOptionType) {
        return strategies.get(paymentOptionType);
    }
}
