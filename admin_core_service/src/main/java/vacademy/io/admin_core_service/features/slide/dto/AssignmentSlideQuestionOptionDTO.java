package vacademy.io.admin_core_service.features.slide.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;
import vacademy.io.common.ai.dto.RichTextDataDTO;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AssignmentSlideQuestionOptionDTO {

    private String id;
    private String assignmentSlideQuestionId;
    private RichTextDataDTO text;
    private String mediaId;
}
