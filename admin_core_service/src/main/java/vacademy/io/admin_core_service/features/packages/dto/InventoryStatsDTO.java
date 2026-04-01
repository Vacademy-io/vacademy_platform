package vacademy.io.admin_core_service.features.packages.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class InventoryStatsDTO {
    private long totalSessions;
    private long unlimitedSessions;
    private long limitedSessions;
    private long totalCapacity;
    private long totalAvailable;
    private long criticalSessions;
    private long lowAvailabilitySessions;
}
