package vacademy.io.admin_core_service.features.payments.manager;

import vacademy.io.admin_core_service.features.user_subscription.dto.MandateInfo;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;
import vacademy.io.common.payment.dto.PaymentResponseDTO;

import java.util.Map;

public interface PaymentServiceStrategy {
    PaymentResponseDTO initiatePayment(UserDTO user, PaymentInitiationRequestDTO request,
            Map<String, Object> paymentGatewaySpecificData);

    Map<String, Object> createCustomer(UserDTO user, PaymentInitiationRequestDTO request,
            Map<String, Object> paymentGatewaySpecificData);

    Map<String, Object> createCustomerForUnknownUser(String email, PaymentInitiationRequestDTO request,
            Map<String, Object> paymentGatewaySpecificData);

    Map<String, Object> findCustomerByEmail(String email, Map<String, Object> paymentGatewaySpecificData);

    // ── Recurring / mandate (autopay) ──────────────────────────────────────
    // Default implementations keep every existing manager compiling and behaving
    // exactly as today. A gateway opts into autopay by overriding these.

    /**
     * First payment that also registers a recurring mandate (UPI Autopay / card
     * e-mandate / card-on-file token). Default: behave like a normal one-time
     * payment (no mandate) — correct for gateways whose normal flow already
     * tokenizes (e.g. eWay creates a TokenCustomer during initiatePayment).
     * Gateways needing extra registration params (Razorpay token block, Stripe
     * SetupIntent) override this.
     */
    default PaymentResponseDTO initiateMandatePayment(UserDTO user, PaymentInitiationRequestDTO request,
            Map<String, Object> paymentGatewaySpecificData) {
        return initiatePayment(user, request, paymentGatewaySpecificData);
    }

    /**
     * Off-session recurring charge against a previously registered mandate.
     * {@code request.amount} is the amount to charge (already validated against
     * {@code mandate.maxAmount} by the caller / the implementation). Default:
     * unsupported — a gateway without autopay simply never has plans flagged
     * auto_renewal_enabled, so this is never reached for it.
     */
    default PaymentResponseDTO chargeRecurring(MandateInfo mandate, PaymentInitiationRequestDTO request,
            Map<String, Object> paymentGatewaySpecificData) {
        throw new UnsupportedOperationException("Recurring charge not supported for this payment gateway");
    }
}
