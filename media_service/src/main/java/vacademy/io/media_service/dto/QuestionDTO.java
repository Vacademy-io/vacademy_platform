package vacademy.io.media_service.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
@AllArgsConstructor
public class QuestionDTO {

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
    private String optionsJson;
    private Map<String, Object> parsedEvaluationObject;
    private String evaluationType;
    private AssessmentRichTextDataDTO explanationText;
    private Integer defaultQuestionTimeMins;
    private String parentRichTextId;
    private AssessmentRichTextDataDTO parentRichText;
    private List<OptionDTO> options = new ArrayList<>();
    private List<String> errors = new ArrayList<>();
    private List<String> warnings = new ArrayList<>();
    private List<String> tags;
    private AiGeneratedQuestionJsonDto.DifficultyLevel level;

    public QuestionDTO(String questionNumber) {
        this.previewId = questionNumber;
    }

    public QuestionDTO() {
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