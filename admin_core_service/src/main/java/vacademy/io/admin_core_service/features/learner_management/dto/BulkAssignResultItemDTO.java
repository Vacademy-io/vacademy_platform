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
public class BulkAssignResultItemDTO {

    private String userId;
    private String userEmail;
    private String packageSessionId;

    /**
     * SUCCESS | SKIPPED | FAILED
     */
    private String status;

    /**
     * What was actually done:
     * CREATED | RE_ENROLLED | NONE
     */
    private String actionTaken;

    private String mappingId;
    private String userPlanId;
    private String enrollInviteIdUsed;

    /** Human-readable explanation (especially useful for SKIPPED / FAILED) */
    private String message;
}
