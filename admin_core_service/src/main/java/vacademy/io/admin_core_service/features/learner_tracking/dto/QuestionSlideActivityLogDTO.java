package vacademy.io.admin_core_service.features.learner_tracking.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class QuestionSlideActivityLogDTO {

    private String id;

    private Integer attemptNumber;

    private String responseJson;

    private String responseStatus;

    private Double marks;
}
