package vacademy.io.admin_core_service.features.course.dto.bulk;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Inventory configuration for bulk course creation.
 * Controls the maximum seats and available slots for a PackageSession.
 * 
 * If both fields are null, the PackageSession will have unlimited capacity.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class BulkCourseInventoryConfigDTO {

    /**
     * Maximum number of seats for this batch.
     * If null, the batch has unlimited capacity.
     */
    private Integer maxSlots;

    /**
     * Initially available slots.
     * If null but maxSlots is set, defaults to maxSlots value.
     */
    private Integer availableSlots;

    /**
     * Returns the effective available slots value.
     * If availableSlots is null but maxSlots is set, returns maxSlots.
     */
    public Integer getEffectiveAvailableSlots() {
        if (availableSlots != null) {
            return availableSlots;
        }
        return maxSlots;
    }
}
