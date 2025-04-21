package vacademy.io.common.ai.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
public class AiEvaluationQuestionDTO {
    private RichTextDataDTO reachText;
    private RichTextDataDTO explanationText;
    private Integer questionOrder;
    private String markingJson;
}
