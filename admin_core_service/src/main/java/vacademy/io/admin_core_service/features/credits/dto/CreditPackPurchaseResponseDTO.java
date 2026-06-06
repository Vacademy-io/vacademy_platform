package vacademy.io.admin_core_service.features.credits.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Builder;
import lombok.Data;

/**
 * Response after creating a Razorpay payment. The frontend redirects the
 * browser to {@code paymentLinkUrl} (Razorpay's hosted page) to pay — this is
 * what lets payment work on the platform's custom admin domains, which Razorpay
 * won't let checkout.js run on. {@code platformPaymentId} is polled for the
 * webhook-driven credit grant.
 */
@Data
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CreditPackPurchaseResponseDTO {
    private String platformPaymentId;   // our id; FE polls /orders/{id}/status
    private String paymentLinkUrl;      // Razorpay hosted page (rzp.io/i/…) — FE redirects here
    private String razorpayOrderId;     // null for the payment-link flow (kept for back-compat)
    private String razorpayKeyId;
    private long amountMinor;           // what Razorpay will charge
    private String currency;            // "INR" / "USD"
    private String packCode;            // for FE display
    private String displayPriceMajor;   // for the "Pay X" button label
}
