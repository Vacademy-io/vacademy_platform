package vacademy.io.assessment_service.features.upload_docx.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

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
    private String questionHtml;
    private List<OptionResponseFromDocx> optionsData = new ArrayList<>();
    private List<String> answerOptionIds = new ArrayList<>();
    private String explanationHtml;
    private List<String> errors = new ArrayList<>();
    private List<String> warnings = new ArrayList<>();

    public void addOption(OptionResponseFromDocx option) {
        this.optionsData.add(option);
    }

    public void setQuestionHtml(String html) {
        this.questionHtml = html;
    }

    public void appendQuestionHtml(String html) {
        this.questionHtml = (this.questionHtml == null ? "" : this.questionHtml) + html;
    }

    public void appendExplanationHtml(String html) {
        this.explanationHtml = (this.explanationHtml == null ? "" : this.explanationHtml) + html;
    }

    public QuestionResponseFromDocx(int questionId) {
        this.questionId = questionId;
    }

}
