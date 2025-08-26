package vacademy.io.common.payment.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.payment.enums.PaymentGateway;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class PaymentInitiationRequestDTO {
    private Double amount;
    private String currency;
    private String description;
    private boolean isIncludePendingItems;
    private boolean chargeAutomatically;
    private String orderId;
    private String instituteId;
    private String email;

    private StripeRequestDTO stripeRequest;
    private RazorpayRequestDTO razorpayRequest;
    private PayPalRequestDTO payPalRequest;
}
