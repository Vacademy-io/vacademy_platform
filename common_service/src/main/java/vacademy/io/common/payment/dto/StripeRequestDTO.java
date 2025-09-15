package vacademy.io.common.payment.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class StripeRequestDTO {
    private String paymentMethodId;
    private String cardLast4;
    private String customerId;
    private String returnUrl;
}
