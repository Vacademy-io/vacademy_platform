package vacademy.io.admin_core_service.features.slide.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.common.ai.dto.RichTextDataDTO;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class VideoSlideQuestionDTO {
    private String id;

    private RichTextDataDTO parentRichText;

    private RichTextDataDTO textData;

    private RichTextDataDTO explanationTextData;

    private String mediaId;

    private String questionResponseType;

    private String questionType;

    private String accessLevel;

    private String autoEvaluationJson;

    private String evaluationType;

    private Long questionTimeInMillis;

    private boolean isNewQuestion;

    private Integer questionOrder;

    private List<VideoSlideQuestionOptionDTO> options; // list of options for the slide
}
