package vacademy.io.admin_core_service.features.user_subscription.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.sql.Timestamp;
import java.util.List;
import java.util.Map;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class MembershipFilterDTO {
    private Timestamp startDateInUtc;
    private Timestamp endDateInUtc;
    private List<String> membershipStatuses; // Values: "ENDED", "ABOUT_TO_END"
    private String instituteId;
    private List<String> packageSessionIds;
    Map<String, String> sortOrder;
}