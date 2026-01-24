package vacademy.io.admin_core_service.features.course.dto.bulk;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Main request DTO for bulk course creation.
 * 
 * Configuration Resolution Order:
 * 1. Course-level configuration (highest priority)
 * 2. Global defaults (applyToAll)
 * 3. System defaults (lowest priority)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class BulkAddCourseRequestDTO {

    /**
     * Global defaults that apply to all courses.
     * Can be overridden at the course level.
     */
    private BulkCourseGlobalDefaultsDTO applyToAll;

    /**
     * List of courses to create. REQUIRED.
     * Each course must have at least a courseName.
     */
    private List<BulkCourseItemDTO> courses;

    /**
     * Optional: Dry run mode. If true, validates but doesn't persist.
     * Returns what would be created without actually creating.
     */
    private Boolean dryRun;

    /**
     * Returns whether this is a dry run.
     */
    public boolean isDryRun() {
        return dryRun != null && dryRun;
    }

    /**
     * Gets the global defaults, creating an empty one if null.
     */
    public BulkCourseGlobalDefaultsDTO getApplyToAllOrEmpty() {
        return applyToAll != null ? applyToAll : new BulkCourseGlobalDefaultsDTO();
    }
}
