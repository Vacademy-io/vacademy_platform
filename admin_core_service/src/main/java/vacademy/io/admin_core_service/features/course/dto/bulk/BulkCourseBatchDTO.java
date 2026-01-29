package vacademy.io.admin_core_service.features.course.dto.bulk;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Represents a Level-Session pair (Batch) for bulk course creation.
 * If both levelId and sessionId are null, the system will create a DEFAULT
 * batch.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class BulkCourseBatchDTO {

    /**
     * Optional Level ID. If null, DEFAULT level will be used.
     */
    private String levelId;

    /**
     * Optional Session ID. If null, DEFAULT session will be used.
     */
    private String sessionId;

    /**
     * Optional: Override inventory config for this specific batch.
     * If null, uses the course-level or global inventory config.
     */
    private BulkCourseInventoryConfigDTO inventoryConfig;

    /**
     * Optional: Override payment config for this specific batch.
     * If null, uses the course-level or global payment config.
     */
    private BulkCoursePaymentConfigDTO paymentConfig;
}
