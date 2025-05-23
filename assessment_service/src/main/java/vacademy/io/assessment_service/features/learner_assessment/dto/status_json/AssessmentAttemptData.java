package vacademy.io.assessment_service.features.learner_assessment.dto.status_json;

import lombok.*;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class AssessmentAttemptData {
    private String assessmentId;
    private Long entireTestDurationLeftInSeconds;
    private String status;
    private Long timeElapsedInSeconds;
    private Integer tabSwitchCount;
}
