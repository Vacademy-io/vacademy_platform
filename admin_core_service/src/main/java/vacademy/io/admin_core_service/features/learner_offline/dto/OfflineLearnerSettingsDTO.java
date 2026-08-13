package vacademy.io.admin_core_service.features.learner_offline.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Institute-level offline configuration as the learner app needs to see it.
 * `enabled` is the kill switch the whole offline UI hangs off.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class OfflineLearnerSettingsDTO {
    private boolean enabled;
    private int revalidationDays;
    private int maxDevices;
}
