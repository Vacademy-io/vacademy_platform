package vacademy.io.assessment_service.features.assessment.dto.internal;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * Internal (service-to-service) request to register one or more EXISTING
 * assessments to additional batches (package_sessions).
 *
 * <p>Used by admin_core_service when a chapter that contains an assessment slide
 * is copied or made visible to new batches: the slide rows are duplicated /
 * shared with the same {@code assessmentId}, but the assessment itself stays
 * registered only to the original batch — so learners in the new batches see the
 * slide while the assessment never appears in their list. This request closes
 * that gap by adding {@code assessment_batch_registration} rows for the new
 * batches.
 *
 * <p>Field naming is camelCase (no {@code @JsonNaming}); the admin_core client
 * serialises with matching keys.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RegisterAssessmentBatchesRequest {

    private List<AssessmentBatchEntry> registrations = new ArrayList<>();

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AssessmentBatchEntry {
        private String assessmentId;
        private List<String> batchIds = new ArrayList<>();
    }
}
