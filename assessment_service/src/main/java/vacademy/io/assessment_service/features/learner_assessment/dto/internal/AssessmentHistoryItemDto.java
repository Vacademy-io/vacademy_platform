package vacademy.io.assessment_service.features.learner_assessment.dto.internal;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Date;
import java.util.List;

/**
 * One assessment attempt enriched with comparison data,
 * returned as part of {@link StudentAssessmentHistoryResponse}.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
public class AssessmentHistoryItemDto {

    private String assessmentId;
    private String assessmentName;
    private String attemptId;
    private Date attemptDate;

    /** Student's earned marks. */
    private Double marks;
    /** Assessment's maximum possible marks (sum of section totals). */
    private Double totalMarks;
    /** (marks / totalMarks) * 100, rounded to one decimal place. */
    private Double percentage;
    /** PASS / FAIL / COMPLETED / null */
    private String resultStatus;
    private Long durationSeconds;

    // Comparison data (null when comparison could not be computed)
    private Integer rank;
    private Double percentile;
    /** (correctAttempts / totalAttempts) * 100 for the student. */
    private Double accuracy;
    private Double classAverageMarks;
    private Double classAccuracy;

    /** Section-wise breakdown. Empty list when unavailable. */
    private List<AssessmentSectionSummaryDto> sections;
}
