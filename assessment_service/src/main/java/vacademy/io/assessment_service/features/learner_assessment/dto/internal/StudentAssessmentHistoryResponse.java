package vacademy.io.assessment_service.features.learner_assessment.dto.internal;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * Top-level response for
 * {@code GET /assessment-service/internal/student-analysis/assessment-history}.
 *
 * Consumed by {@code AcademicsCollector} in {@code admin_core_service}.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
public class StudentAssessmentHistoryResponse {

    private String userId;
    private String instituteId;

    /** List of enriched attempt records (capped at MAX_ASSESSMENTS_PER_REPORT). */
    private List<AssessmentHistoryItemDto> assessments;

    /** Aggregate summary derived from {@code assessments}. */
    private AssessmentHistorySummaryDto summary;
}
