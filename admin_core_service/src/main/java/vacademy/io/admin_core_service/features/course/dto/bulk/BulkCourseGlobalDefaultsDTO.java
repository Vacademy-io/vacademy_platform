package vacademy.io.admin_core_service.features.course.dto.bulk;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Global defaults configuration for bulk course creation.
 * These values apply to all courses unless overridden at the course level.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class BulkCourseGlobalDefaultsDTO {

    /**
     * Whether to apply these global settings to all courses.
     * If false, each course must define its own settings.
     */
    private Boolean enabled;

    /**
     * Default batches (level-session pairs) to create for all courses.
     * If empty/null and enabled=true, will create DEFAULT level/session.
     */
    private List<BulkCourseBatchDTO> batches;

    /**
     * Default payment configuration for all courses.
     * Can be overridden per-course.
     */
    private BulkCoursePaymentConfigDTO paymentConfig;

    /**
     * Default inventory configuration for all courses.
     * Can be overridden per-course or per-batch.
     */
    private BulkCourseInventoryConfigDTO inventoryConfig;

    /**
     * Default course type for all courses.
     * Valid values: COURSE, MEMBERSHIP, PRODUCT, SERVICE
     */
    private String courseType;

    /**
     * Default course depth for all courses.
     * Defaults to 5 if not specified.
     */
    private Integer courseDepth;

    /**
     * Default tags to apply to all courses.
     */
    private List<String> tags;

    /**
     * Whether to publish courses to catalogue by default.
     */
    private Boolean publishToCatalogue;

    /**
     * Returns whether global defaults are enabled.
     */
    public boolean isEnabled() {
        return enabled != null && enabled;
    }

    /**
     * Returns effective course depth, defaulting to 5.
     */
    public int getEffectiveCourseDepth() {
        return courseDepth != null ? courseDepth : 5;
    }

    /**
     * Returns effective course type, defaulting to COURSE.
     */
    public String getEffectiveCourseType() {
        return courseType != null && !courseType.isBlank() ? courseType : "COURSE";
    }
}
