package vacademy.io.assessment_service.features.learner_assessment.dto.internal;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Map;

/**
 * Top-level response for
 * {@code POST /assessment-service/internal/student-analysis/assessment-history/batch}.
 *
 * Contains an entry ONLY for userIds with at least one ENDED attempt in the window;
 * absent userIds mean "no data" — never emitted as zeroed summaries.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
public class BatchAssessmentHistoryResponse {

    /** userId → summary; only users with data appear. */
    private Map<String, UserAssessmentSummaryDto> byUserId;
}
