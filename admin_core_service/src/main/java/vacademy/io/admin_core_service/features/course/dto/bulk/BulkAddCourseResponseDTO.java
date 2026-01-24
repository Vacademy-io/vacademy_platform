package vacademy.io.admin_core_service.features.course.dto.bulk;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * Response DTO for bulk course creation API.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class BulkAddCourseResponseDTO {

    /**
     * Total number of courses requested.
     */
    private int totalRequested;

    /**
     * Number of successfully created courses.
     */
    private int successCount;

    /**
     * Number of failed course creations.
     */
    private int failureCount;

    /**
     * Whether this was a dry run (validation only).
     */
    private boolean dryRun;

    /**
     * Detailed results for each course.
     */
    private List<BulkCourseResultDTO> results;

    /**
     * Creates an empty response builder.
     */
    public static BulkAddCourseResponseDTO.BulkAddCourseResponseDTOBuilder empty(int totalRequested, boolean dryRun) {
        return BulkAddCourseResponseDTO.builder()
                .totalRequested(totalRequested)
                .successCount(0)
                .failureCount(0)
                .dryRun(dryRun)
                .results(new ArrayList<>());
    }

    /**
     * Adds a result and updates counts.
     */
    public void addResult(BulkCourseResultDTO result) {
        if (results == null) {
            results = new ArrayList<>();
        }
        results.add(result);

        if ("SUCCESS".equals(result.getStatus())) {
            successCount++;
        } else {
            failureCount++;
        }
    }
}
