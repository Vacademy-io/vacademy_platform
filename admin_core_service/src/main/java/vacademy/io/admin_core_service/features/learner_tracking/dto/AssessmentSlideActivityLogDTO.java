package vacademy.io.admin_core_service.features.learner_tracking.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.sql.Timestamp;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class AssessmentSlideActivityLogDTO {
    private String id;

    // assessment-service attempt id this submission corresponds to.
    private String attemptId;

    // For manual assessments: the learner's uploaded answer file id(s).
    private String commaSeparatedFileIds;

    private Timestamp dateSubmitted;
}
