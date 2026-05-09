package vacademy.io.admin_core_service.features.credits.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Builder;
import lombok.Data;

/**
 * Response after creating a Razorpay order. The frontend feeds these into
 * Razorpay Checkout via {@code Razorpay({key_id, order_id, ...}).open()}.
 */
@Data
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CreditPackPurchaseResponseDTO {
    private String platformPaymentId;   // our id; FE polls /orders/{id}/status
    private String razorpayOrderId;
    private String razorpayKeyId;
    private long amountMinor;           // what Razorpay will charge
    private String currency;            // "INR" / "USD"
    private String packCode;            // for FE display
    private String displayPriceMajor;   // for the "Pay X" button label
}
