package vacademy.io.assessment_service.features.upload_docx.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import vacademy.io.assessment_service.features.rich_text.dto.AssessmentRichTextDataDTO;
import vacademy.io.assessment_service.features.rich_text.enums.TextType;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class QuestionResponseFromDocx {
    private int questionId;
    private String sectionId;
    private String sectionOrder;
    private AssessmentRichTextDataDTO questionText;
    private List<OptionResponseFromDocx> optionsData = new ArrayList<>();
    private String evaluationJson;
    private AssessmentRichTextDataDTO explanationHtml;
    private List<String> errors = new ArrayList<>();
    private List<String> warnings = new ArrayList<>();

    public void addOption(OptionResponseFromDocx option) {
        this.optionsData.add(option);
    }

    public void setQuestionHtml(AssessmentRichTextDataDTO html) {
        this.questionText = html;
    }

    public void appendQuestionHtml(String html) {
        String updatedValue = (this.questionText == null ? "" : this.questionText) + html;
        this.questionText = new AssessmentRichTextDataDTO(null, TextType.HTML.name(), updatedValue);
    }

    public void appendExplanationHtml(String html) {
        String updatedValue =  (this.explanationHtml == null ? "" : this.explanationHtml) + html;
        this.explanationHtml = new AssessmentRichTextDataDTO(null, TextType.HTML.name(), updatedValue);
    }

    public QuestionResponseFromDocx(int questionId) {
        this.questionId = questionId;
    }

}
