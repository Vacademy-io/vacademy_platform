package vacademy.io.admin_core_service.features.user_subscription.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class PaymentOptionFilterDTO {
    private List<String>types;
    private String source;
    private String sourceId;
    private boolean requireApproval;
    private boolean notRequireApproval;
}
