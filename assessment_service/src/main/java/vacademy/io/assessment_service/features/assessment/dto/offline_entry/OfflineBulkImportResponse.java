package vacademy.io.assessment_service.features.assessment.dto.offline_entry;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

import java.util.List;

/**
 * Per-row outcome of a bulk import. One bad row never fails the batch — the
 * admin gets back exactly which students imported and why the rest didn't.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class OfflineBulkImportResponse {

    private List<OfflineBulkImportResult> results;
    private int successCount;
    private int failureCount;

    @Getter
    @Setter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class OfflineBulkImportResult {
        private String rowLabel;
        private String username;
        // SUCCESS | FAILED
        private String status;
        private String attemptId;
        private String message;
    }
}
