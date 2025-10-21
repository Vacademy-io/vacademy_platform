package vacademy.io.admin_core_service.features.user_subscription.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.List;
import java.util.Map;

@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@Data
public class UserPlanFilterDTO {
    private List<String> statuses;
    private Map<String, String> sortColumns;
    private String userId;
    private String instituteId;
}
