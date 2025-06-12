package vacademy.io.admin_core_service.features.learner_tracking.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

import java.util.Date;

@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public interface DailyTimeSpentProjection {
    Date getActivityDate();
    Long getTimeSpentByUserMillis();
    Long getAvgTimeSpentByBatchMillis();
}
