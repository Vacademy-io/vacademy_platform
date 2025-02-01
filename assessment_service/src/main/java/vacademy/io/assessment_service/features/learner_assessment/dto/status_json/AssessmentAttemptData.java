package vacademy.io.assessment_service.features.learner_assessment.dto.status_json;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AssessmentAttemptData {
    private String assessmentId;
    private Long entireTestDurationLeftInSeconds;
    private String status;
    private Long timeElapsedInSeconds;
    private Integer tabSwitchCount;
}
