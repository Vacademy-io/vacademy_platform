package vacademy.io.assessment_service.features.learner_assessment.dto.status_json;

import lombok.*;

import java.util.List;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class LearnerAssessmentAttemptDataDto {
    private String attemptId;
    private String clientLastSync;
    private AssessmentAttemptData assessment;
    private List<SectionAttemptData> sections;
}
