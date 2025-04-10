package vacademy.io.community_service.feature.presentation.dto.question;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;
import vacademy.io.community_service.feature.filter.service.EvaluationJsonToMapConverter;
import vacademy.io.community_service.feature.presentation.entity.question.Option;
import vacademy.io.community_service.feature.presentation.entity.question.Question;
import vacademy.io.community_service.feature.rich_text.dto.AssessmentRichTextDataDTO;


import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
@AllArgsConstructor
public class PreviewQuestionDTO {

    private String id;
    private String previewId;
    private String sectionId;
    private Integer questionOrderInSection;
    private AssessmentRichTextDataDTO text;
    private String mediaId;
    private Date createdAt;
    private Date updatedAt;
    private String questionResponseType;
    private String questionType;
    private String accessLevel;
    private String autoEvaluationJson;
    private Map<String, Object> parsedEvaluationObject;
    private String evaluationType;
    private AssessmentRichTextDataDTO explanationText;
    private Integer defaultQuestionTimeMins;
    private List<OptionDTO> options = new ArrayList<>();
    private List<String> errors = new ArrayList<>();
    private List<String> warnings = new ArrayList<>();

    // Default constructor
    public PreviewQuestionDTO() {
    }

    // Constructor from Question entity
    public PreviewQuestionDTO(Question question, Boolean provideSolution) {
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
            this.parsedEvaluationObject = EvaluationJsonToMapConverter.convertJsonToMap(question.getAutoEvaluationJson());
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


    public PreviewQuestionDTO(String questionNumber) {
        this.previewId = questionNumber;
    }

    public void appendQuestionHtml(String s) {
        String updatedHtml = (this.text.getContent() == null) ? "" : this.text.getContent() + s;
        this.text.setContent(updatedHtml);
    }

    public void appendExplanationHtml(String s) {
        String updatedHtml = (this.explanationText.getContent() == null) ? "" : this.explanationText.getContent() + s;
        this.explanationText.setContent(updatedHtml);
    }
}
