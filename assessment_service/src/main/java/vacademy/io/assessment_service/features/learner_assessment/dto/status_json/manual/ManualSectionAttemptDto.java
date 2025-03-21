package vacademy.io.assessment_service.features.learner_assessment.dto.status_json.manual;

import lombok.*;
import vacademy.io.assessment_service.features.learner_assessment.dto.status_json.QuestionAttemptData;

import java.util.List;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class ManualSectionAttemptDto {
    private String sectionId;
    private Long sectionDurationLeftInSeconds;
    private Long timeElapsedInSeconds;
    private List<ManualQuestionAttemptDto> questions;
}
