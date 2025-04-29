package vacademy.io.common.ai.dto;

import lombok.Data;

@Data
public class AiEvaluationQuestionDTO {
    private RichTextDataDTO reachText;
    private RichTextDataDTO explanationText;
    private Integer questionOrder;
    private String markingJson;
}
