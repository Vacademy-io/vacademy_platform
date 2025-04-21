package vacademy.io.assessment_service.features.assessment_free_tool.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.assessment_service.features.rich_text.dto.AssessmentRichTextDataDTO;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Data
public class SectionQuestionsDTO {
    private String id;
    private AssessmentRichTextDataDTO questionText;
    private String questionResponseType;
    private String questionType;
    private String evaluationType;
    private AssessmentRichTextDataDTO explanation;
    private String markingJson;
    private Integer questionOrder;
    private boolean newQuestion;
}
