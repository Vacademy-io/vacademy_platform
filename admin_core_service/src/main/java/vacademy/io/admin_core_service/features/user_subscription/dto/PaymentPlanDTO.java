package vacademy.io.admin_core_service.features.user_subscription.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Builder;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@Builder
public class PaymentPlanDTO {
    private String id;
    private String name;
    private String status;
    private Integer validityInDays;
    private double actualPrice;
    private double elevatedPrice;
    private String currency;
    private String description;
    private String tag;
    private String featureJson;
}
