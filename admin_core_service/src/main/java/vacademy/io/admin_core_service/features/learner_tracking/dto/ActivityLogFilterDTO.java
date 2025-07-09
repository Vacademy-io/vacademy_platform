package vacademy.io.admin_core_service.features.learner_tracking.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.sql.Timestamp;
import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ActivityLogFilterDTO {
    private String userId;
    private List<String> packageSessionIds;
    private Timestamp startDate;
    private Timestamp endDate;
}
