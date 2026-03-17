package vacademy.io.admin_core_service.features.migration.dto.v2;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Response DTO for bulk enrollment import (API 2)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BulkEnrollmentImportResponseDTO {

    @JsonProperty("total_requested")
    private int totalRequested;

    @JsonProperty("success_count")
    private int successCount;

    @JsonProperty("failure_count")
    private int failureCount;

    @JsonProperty("skipped_count")
    private int skippedCount;

    @JsonProperty("dry_run")
    private boolean dryRun;

    @JsonProperty("results")
    private List<EnrollmentImportResultDTO> results;

    // Factory method for empty response
    public static BulkEnrollmentImportResponseDTO empty(boolean dryRun) {
        return BulkEnrollmentImportResponseDTO.builder()
                .totalRequested(0)
                .successCount(0)
                .failureCount(0)
                .skippedCount(0)
                .dryRun(dryRun)
                .results(List.of())
                .build();
    }
}
