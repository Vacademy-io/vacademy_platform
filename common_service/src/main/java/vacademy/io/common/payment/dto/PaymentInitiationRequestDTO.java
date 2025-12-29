package vacademy.io.common.payment.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class PaymentInitiationRequestDTO {
    private Double amount;
    private String currency;
    private String description;

    @JsonProperty("is_include_pending_items")
    private boolean isIncludePendingItems;

    @JsonProperty("charge_automatically")
    private boolean chargeAutomatically;

    @JsonProperty("order_id")
    private String orderId;

    @JsonProperty("institute_id")
    private String instituteId;

    private String email;
    private String vendor;

    @JsonProperty("vendor_id")
    private String vendorId;
    private StripeRequestDTO stripeRequest;
    private RazorpayRequestDTO razorpayRequest;
    private PayPalRequestDTO payPalRequest;
    private ManualPaymentDTO manualRequest;
    private EwayRequestDTO ewayRequest;
    private PhonePeRequestDTO phonePeRequest;
}
