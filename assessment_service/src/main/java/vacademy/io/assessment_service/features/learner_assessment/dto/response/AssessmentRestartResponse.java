package vacademy.io.assessment_service.features.learner_assessment.dto.response;


import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;
import vacademy.io.assessment_service.features.learner_assessment.dto.LearnerAssessmentStartAssessmentResponse;
import vacademy.io.assessment_service.features.learner_assessment.dto.LearnerAssessmentStartPreviewResponse;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AssessmentRestartResponse {
    LearnerAssessmentStartAssessmentResponse startAssessmentResponse;
    LearnerAssessmentStartPreviewResponse previewResponse;
    String attemptDataJson;
    LearnerUpdateStatusResponse updateStatusResponse;
}
