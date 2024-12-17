package vacademy.io.assessment_service.features.question_core.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import vacademy.io.assessment_service.features.question_core.entity.Option;
import vacademy.io.assessment_service.features.question_core.entity.Question;
import vacademy.io.assessment_service.features.rich_text.dto.AssessmentRichTextDataDTO;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

@Getter
@Setter
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
@AllArgsConstructor
public class QuestionDTO {

    private String id;
    private AssessmentRichTextDataDTO text;
    private String mediaId;
    private Date createdAt;
    private Date updatedAt;
    private String questionResponseType;
    private String questionType;
    private String accessLevel;
    private String autoEvaluationJson;
    private String evaluationType;
    private AssessmentRichTextDataDTO explanationText;
    private Integer defaultQuestionTimeMins;
    private List<OptionDTO> options = new ArrayList<>();

    // Default constructor
    public QuestionDTO() {
    }

    // Constructor from Question entity
    public QuestionDTO(Question question, Boolean provideSolution) {
        this.id = question.getId();
        this.mediaId = question.getMediaId();
        this.createdAt = question.getCreatedAt(); // Convert Timestamp to String
        this.updatedAt = question.getUpdatedAt(); // Convert Timestamp to String
        this.questionResponseType = question.getQuestionResponseType();
        this.questionType = question.getQuestionType();
        this.accessLevel = question.getAccessLevel();
        if (provideSolution) {
            this.autoEvaluationJson = question.getAutoEvaluationJson();
            this.evaluationType = question.getEvaluationType();
        }
        this.defaultQuestionTimeMins = question.getDefaultQuestionTimeMins();

        // Convert AssessmentRichTextData to DTOs
        if (question.getTextData() != null) {
            this.text = new AssessmentRichTextDataDTO(question.getTextData());
        }

        if (question.getExplanationTextData() != null && provideSolution) {
            this.explanationText = new AssessmentRichTextDataDTO(question.getExplanationTextData());
        }

        if (question.getOptions() != null) {
            for (Option option : question.getOptions()) {
                this.options.add(new OptionDTO(option));
            }
        }
    }


}
