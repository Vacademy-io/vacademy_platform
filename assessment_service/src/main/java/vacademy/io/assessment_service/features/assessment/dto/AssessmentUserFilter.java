package vacademy.io.assessment_service.features.assessment.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AssessmentUserFilter {
    private String name;
    private String assessmentType;
    private List<String> attemptType;
    private String registrationSource;
    private List<String> batches;
    private List<String> status;
    // Optional filter on the attempt's evaluation state (student_attempt.result_status),
    // e.g. ["PENDING"] to show only submissions a teacher still needs to grade.
    private List<String> evaluationStatus;
    // Optional filter on whether the attempt has a submitted answer-sheet file
    // (manual evaluation assessments): values "SUBMITTED" / "NOT_SUBMITTED".
    private List<String> submissionStatus;
    private Map<String, String> sortColumns;
}
