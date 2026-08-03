package vacademy.io.assessment_service.features.assessment.dto.offline_entry;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

import java.util.List;

/**
 * One bulk offline data-entry pass: a row per student carrying their total marks
 * and the file ids of the sheets already uploaded to storage by the caller.
 * <p>
 * The files are uploaded client-side first so this stays a single JSON request —
 * the service never receives the PDFs themselves.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class OfflineBulkImportRequest {

    private List<OfflineBulkImportEntry> entries;

    @Getter
    @Setter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class OfflineBulkImportEntry {
        // Echoed back on the result row so the admin can find the CSV line that failed.
        private String rowLabel;

        // Either an existing registration, or the details needed to create one
        // (mirrors OfflineAttemptCreateRequest).
        private String registrationId;
        private String userId;
        private String fullName;
        private String email;
        private String username;
        private String mobileNumber;
        private String batchId;

        // Null leaves the attempt's marks untouched (attachments-only row).
        private Double totalMarks;

        private String studentFileId;
        private String checkedFileId;
        private String reportFileId;
    }
}
