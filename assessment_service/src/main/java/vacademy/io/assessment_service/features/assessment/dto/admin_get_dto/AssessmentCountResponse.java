package vacademy.io.assessment_service.features.assessment.dto.admin_get_dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public interface AssessmentCountResponse {
    Integer getLiveCount();

    Integer getUpcomingCount();

    Integer getPreviousCount();

    Integer getDraftCount();
}
