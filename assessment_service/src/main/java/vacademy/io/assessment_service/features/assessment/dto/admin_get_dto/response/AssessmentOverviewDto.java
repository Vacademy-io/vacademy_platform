package vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import java.util.Date;
import java.util.List;

@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public interface AssessmentOverviewDto {
    Date getCreatedOn();
    Date getStartDateAndTime();
    Date getEndDateAndTime();
    Long getDurationInMin();
    Long getTotalParticipants();
    Double getAverageDuration();
    Double getAverageMarks();
    Long getTotalAttempted();
    Long getTotalOngoing();
    String getSubjectId();

}
