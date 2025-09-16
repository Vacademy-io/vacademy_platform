package vacademy.io.admin_core_service.features.user_subscription.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@Builder
public class PaymentOptionDTO {
    private String id;
    private String name;
    private String status;
    private String source;
    private String sourceId;
    private String tag;
    private String type;
    private boolean requireApproval;
    private String unit;
    private List<PaymentPlanDTO> paymentPlans;
    private String paymentOptionMetadataJson;
}
