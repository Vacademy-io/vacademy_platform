package vacademy.io.admin_core_service.features.slide.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.common.ai.dto.RichTextDataDTO;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class VideoSlideQuestionOptionDTO {

    private String id;

    private RichTextDataDTO text;

    private RichTextDataDTO explanationTextData;

    private String mediaId;

    private String previewId;
}
