package vacademy.io.assessment_service.features.assessment.dto.manual_evaluation;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AssessmentSetDto {
    private String id;
    private String assessmentId;
    private String setName;
    private String status;
    private String json;
}
