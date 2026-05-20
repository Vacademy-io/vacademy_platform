package vacademy.io.common.payment.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class RazorpayRequestDTO {
    private String customerId;
    private String contact;
    private String email;
    private String applicantId;
    private String paymentOptionId;

    // Set by Razorpay JS SDK after payment — used for Phase 2 signature verification
    private String razorpayPaymentId;
    private String razorpayOrderId;
    private String razorpaySignature;
}
