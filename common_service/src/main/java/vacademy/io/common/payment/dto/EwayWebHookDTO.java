package vacademy.io.common.payment.dto;

import lombok.Data;

@Data
public class EwayWebHookDTO {
    private String instituteId;
    private PaymentResponseDTO paymentResponse;
}
