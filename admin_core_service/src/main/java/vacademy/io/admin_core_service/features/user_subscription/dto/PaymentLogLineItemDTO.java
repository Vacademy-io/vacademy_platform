package vacademy.io.admin_core_service.features.user_subscription.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class PaymentLogLineItemDTO {
    private String type;
    private Double amount;
    private String currency;
    private String description;
    private String source;
    private String sourceId;
}
