package vacademy.io.assessment_service.features.assessment.dto.export.zip;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import vacademy.io.assessment_service.features.assessment.dto.AssessmentUserFilter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ReportZipInitiateRequest {
    private String assessmentId;
    private String instituteId;
    /** Explicit selection. If present and non-empty, takes precedence over {@code filter}. */
    private List<String> attemptIds;
    /** "All matching current filter" — the same filter DTO the submissions list already uses. */
    private AssessmentUserFilter filter;
    private boolean regenerate;
}
