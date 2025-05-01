package vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response;


import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;
import vacademy.io.assessment_service.features.rich_text.dto.AssessmentRichTextDataDTO;

import java.util.List;


@Builder
@Getter
@Setter
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class StudentReportAnswerReviewDto {
    private String parentId;
    private AssessmentRichTextDataDTO parentRichText;
    private String questionId;
    private Integer questionOrder;
    private String questionName;
    private String questionType;
    private AssessmentRichTextDataDTO questionText;
    private String studentResponseOptions;
    private String correctOptions;
    private String explanationId;
    private String explanation;
    private AssessmentRichTextDataDTO explanationText;
    private double mark;
    private Long timeTakenInSeconds;
    private String answerStatus;


    @Builder
    @Getter
    @Setter
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class ReportOptionsDto {
        private String optionId;
        private String optionName;
        private AssessmentRichTextDataDTO text;
    }
}
