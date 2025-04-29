package vacademy.io.admin_core_service.features.learner_reports.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public interface LearnerActivityDataProjection {
    String getUserId();

    String getFullName();

    String getEmail();

    Double getAvgConcentration();

    Double getTotalTime();

    Double getDailyAvgTime();

    Integer getRank();
}

