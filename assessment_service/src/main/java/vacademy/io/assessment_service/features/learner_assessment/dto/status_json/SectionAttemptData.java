package vacademy.io.assessment_service.features.learner_assessment.dto.status_json;

import lombok.*;

import java.util.List;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class SectionAttemptData {
    private String sectionId;
    private Long sectionDurationLeftInSeconds;
    private Long timeElapsedInSeconds;
    private List<QuestionAttemptData> questions;
}
