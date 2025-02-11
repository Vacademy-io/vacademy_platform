package vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;
import vacademy.io.assessment_service.features.assessment.dto.AssessmentQuestionPreviewDto;
import vacademy.io.assessment_service.features.learner_assessment.dto.QuestionStatusDto;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@Builder
public class QuestionInsightsResponse {
    List<QuestionInsightDto> questionInsightDto = new ArrayList<>();


    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    @Builder
    public static class QuestionInsightDto{
        private AssessmentQuestionPreviewDto assessmentQuestionPreviewDto;
        private QuestionStatusDto questionStatus;
        private Long skipped;
        private Long totalAttempts;
        private List<Top3CorrectResponseDto> top3CorrectResponseDto;
    }
}
