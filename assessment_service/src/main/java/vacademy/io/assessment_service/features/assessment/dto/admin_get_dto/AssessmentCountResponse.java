package vacademy.io.assessment_service.features.assessment.dto.admin_get_dto;

import lombok.Builder;


public interface AssessmentCountResponse {
    Integer getLiveCount();
    Integer getUpcomingCount();
    Integer getPreviousCount();
    Integer getDraftCount();
}
