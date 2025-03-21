package vacademy.io.assessment_service.features.learner_assessment.dto.status_json.manual;

import lombok.*;

import java.util.List;


@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class LearnerManualAttemptDataDto {
    private String attemptId;
    private String clientLastSync;
    private String fileId;
    private String setId;
    private ManualAssessmentAttemptDto assessment;
    private List<ManualSectionAttemptDto> sections;
}
