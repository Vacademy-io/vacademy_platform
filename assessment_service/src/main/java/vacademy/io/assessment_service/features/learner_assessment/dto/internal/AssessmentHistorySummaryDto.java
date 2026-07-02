package vacademy.io.assessment_service.features.learner_assessment.dto.internal;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Aggregate summary computed from all returned {@link AssessmentHistoryItemDto} entries.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
public class AssessmentHistorySummaryDto {

    private int totalAssessments;
    /** Average percentage across all returned assessments. */
    private Double averagePercentage;
    /** assessmentId of the attempt with the highest percentage. */
    private String bestAssessment;
    /** assessmentId of the attempt with the lowest percentage. */
    private String weakestAssessment;
}
