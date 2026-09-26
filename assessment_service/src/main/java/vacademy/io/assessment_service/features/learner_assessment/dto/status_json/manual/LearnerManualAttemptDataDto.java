package vacademy.io.assessment_service.features.learner_assessment.dto.status_json.manual;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;

import java.util.List;


@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
// Parsed with a plain ObjectMapper on the PDF-upload submit; a field a newer
// learner app adds (writingSignals) must not fail that submit.
@JsonIgnoreProperties(ignoreUnknown = true)
public class LearnerManualAttemptDataDto {
    private String attemptId;
    private String clientLastSync;
    private String fileId;
    private String setId;
    private ManualAssessmentAttemptDto assessment;
    private List<ManualSectionAttemptDto> sections;
}
