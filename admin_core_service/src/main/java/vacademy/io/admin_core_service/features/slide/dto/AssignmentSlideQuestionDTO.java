package vacademy.io.admin_core_service.features.slide.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.common.ai.dto.RichTextDataDTO;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class AssignmentSlideQuestionDTO {
    private String id;

    private RichTextDataDTO textData;

    private boolean isNewQuestion;

    private Integer questionOrder;

    private String status;
}
