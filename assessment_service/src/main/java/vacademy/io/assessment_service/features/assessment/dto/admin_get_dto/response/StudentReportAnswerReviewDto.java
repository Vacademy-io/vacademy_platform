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
    // Remark left by the evaluator during manual evaluation, shown to the learner.
    private String evaluatorFeedback;
    // AI-evaluation output shown to the learner (copy-check). aiFeedback is the
    // AI's per-question feedback; aiCriteriaBreakdown is the raw JSON array of
    // {criteria_name, marks, reason}; evaluationSource is AI / AI_REVIEWED /
    // MANUAL / AUTO (from question_wise_marks.marks_source) for disclosure.
    private String aiFeedback;
    private String aiCriteriaBreakdown;
    private String evaluationSource;

}
