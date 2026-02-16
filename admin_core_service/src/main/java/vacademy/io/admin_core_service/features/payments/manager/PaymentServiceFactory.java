package vacademy.io.admin_core_service.features.payments.manager;

import org.springframework.stereotype.Component;
import vacademy.io.common.payment.enums.PaymentGateway;

import java.util.Map;

@Component
public class PaymentServiceFactory {
    private final Map<PaymentGateway, PaymentServiceStrategy> strategies;

    public PaymentServiceFactory(
            StripePaymentManager stripe,
            RazorpayPaymentManager razorpay,
            PayPalPaymentManager paypal,
            EwayPaymentManager eway,
            PhonePePaymentManager phonepe,
            CashfreePaymentManager cashfree) {
        strategies = Map.of(
                PaymentGateway.STRIPE, stripe,
                PaymentGateway.RAZORPAY, razorpay,
                PaymentGateway.PAYPAL, paypal,
                PaymentGateway.EWAY, eway,
                PaymentGateway.PHONEPE, phonepe,
                PaymentGateway.CASHFREE, cashfree);
    }

    public PaymentServiceStrategy getStrategy(PaymentGateway gateway) {
        return strategies.get(gateway);
    }
}
