package vacademy.io.assessment_service.features.learner_assessment.dto.response;


import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;
import vacademy.io.assessment_service.features.learner_assessment.dto.LearnerAssessmentStartPreviewResponse;
import vacademy.io.assessment_service.features.learner_assessment.dto.status_json.LearnerAssessmentAttemptDataDto;

import java.util.Date;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AssessmentRestartResponse {
    private Date startTime;
    LearnerAssessmentStartPreviewResponse previewResponse;
    LearnerAssessmentAttemptDataDto learnerAssessmentAttemptDataDto;
    LearnerUpdateStatusResponse updateStatusResponse;
}
