package vacademy.io.assessment_service.features.learner_assessment.dto.status_json.manual;

import lombok.*;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class ManualQuestionAttemptDto {
    private String questionId;
    private Boolean isMarkedForReview;
    private Boolean isVisited;
    private Long questionDurationLeftInSeconds;
    private Long timeTakenInSeconds;
}
