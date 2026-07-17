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
 * Request body for
 * {@code POST /assessment-service/internal/student-analysis/assessment-history/batch}.
 *
 * Consumed by the Engagement Engine in {@code admin_core_service}.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
public class BatchAssessmentHistoryRequest {

    /** Required; institute UUID used to scope assessments via assessment_institute_mapping. */
    private String instituteId;

    /** Required; cohort of learner UUIDs. Max 500 per call (400 otherwise). */
    private List<String> userIds;

    /** Optional; look-back window in days. Defaults to 90 when null. */
    private Integer sinceDays;
}
