package vacademy.io.assessment_service.features.question_core.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import vacademy.io.assessment_service.features.rich_text.dto.AssessmentRichTextDataDTO;
import vacademy.io.assessment_service.features.rich_text.entity.AssessmentRichTextData;

@Getter
@Setter
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
@AllArgsConstructor
@NoArgsConstructor
public class LongAnswerEvaluationDTO {
    private String type;
    private LongAnswerEvaluationData data;

    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    public static class LongAnswerEvaluationData {
        private AssessmentRichTextDataDTO answer;  // Stores integer, 1 decimal, 2 decimals, or negative numbers
    }
}

