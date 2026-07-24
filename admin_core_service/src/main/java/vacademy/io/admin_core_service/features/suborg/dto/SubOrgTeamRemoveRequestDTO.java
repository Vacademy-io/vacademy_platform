package vacademy.io.admin_core_service.features.suborg.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SubOrgTeamRemoveRequestDTO {
    private String subOrgId;
    private String instituteId;
    private String userId;

    /**
     * SOFT — keep the member ACTIVE until {@link #accessTillDate}, then the nightly
     * sweep deactivates them. HARD — deactivate immediately (the pre-existing
     * behaviour). Defaults to HARD when blank so older callers are unaffected.
     */
    private String mode;

    /**
     * SOFT-mode "last access date" (bare {@code yyyy-MM-dd} or full ISO-8601).
     * Required for a meaningful SOFT removal; ignored for HARD.
     */
    private String accessTillDate;
}
