package vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.assessment_service.features.assessment.dto.AssessmentQuestionPreviewDto;

@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class QuestionInsightsResponse {
    private AssessmentQuestionPreviewDto assessmentQuestionPreviewDto;
    private Integer correctRespondents;
    private Integer partiallyCorrectRespondents;
    private Integer wrongRespondents;
    private Integer skipped;
}
