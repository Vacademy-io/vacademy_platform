package vacademy.io.assessment_service.features.assessment.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AssessmentAccessDto {
    private BatchesAndUsersDto assessmentCreationAccess;
    private BatchesAndUsersDto liveAssessmentNotificationAccess;
    private BatchesAndUsersDto assessmentSubmissionAndReportAccess;
    private BatchesAndUsersDto evaluationProcessAccess;
}
