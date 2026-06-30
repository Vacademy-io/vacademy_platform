package vacademy.io.admin_core_service.features.slide.client;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * Body for the internal call to assessment_service's
 * {@code /internal/assessment-registration/register-batches} endpoint. Mirrors
 * assessment_service's {@code RegisterAssessmentBatchesRequest} (camelCase keys).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AssessmentBatchRegistrationRequest {

    private List<AssessmentBatchEntry> registrations = new ArrayList<>();

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AssessmentBatchEntry {
        private String assessmentId;
        private List<String> batchIds = new ArrayList<>();
    }
}
