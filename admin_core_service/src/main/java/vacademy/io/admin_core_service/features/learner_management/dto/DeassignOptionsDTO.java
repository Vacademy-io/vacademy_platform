package vacademy.io.admin_core_service.features.learner_management.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class DeassignOptionsDTO {

    /**
     * SOFT — mark plan CANCELED, access continues until expiry
     * HARD — mark plan TERMINATED, immediate access revocation
     */
    @Builder.Default
    private String mode = "SOFT";

    @Builder.Default
    private boolean notifyLearners = true;

    @Builder.Default
    private boolean dryRun = false;
}
