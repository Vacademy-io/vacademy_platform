package vacademy.io.admin_core_service.features.slide.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;
import vacademy.io.common.ai.dto.RichTextDataDTO;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class QuizSlideQuestionDTO {

    private String id;

    private RichTextDataDTO parentRichText;
    private RichTextDataDTO text;
    private RichTextDataDTO explanationText;

    private String mediaId;
    private String status;
    private String questionResponseType;
    private String questionType;
    private String accessLevel;
    private String autoEvaluationJson;
    private String evaluationType;
    private Integer questionOrder;
    private String quizSlideId;
    private Boolean canSkip;

    private List<QuizSlideQuestionOptionDTO> options;
}
