package vacademy.io.admin_core_service.features.counsellor_workbench.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Request body for both /reassign and /reassign/preview.
 *
 * mode = SINGLE        → target_user_id required; all open leads from this
 *                        counsellor go to target_user_id.
 * mode = ROUND_ROBIN   → leads spread across active counsellors in the same
 *                        team subtree, ordered by counselor_pool_member
 *                        display_order (or alphabetic if not pooled).
 * mode = MANUAL        → assignments list required; each lead mapped to its
 *                        explicit target. Used by the preview-with-overrides
 *                        flow on the UI.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ReassignRequest {

    private String instituteId;
    private String fromUserId;
    private String mode;                       // SINGLE | ROUND_ROBIN | MANUAL

    private String targetUserId;               // SINGLE mode
    private List<Assignment> assignments;      // MANUAL mode

    /**
     * When true the source counsellor's pool memberships are flipped to
     * INACTIVE in the same transaction as the reassignment commit. Powers
     * the reassign-first flow on the workbench — a manager confirms one
     * action that both moves the leads and takes the person offline.
     * Defaults to false (existing reassign-without-deactivation behaviour).
     */
    private Boolean markInactive;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class Assignment {
        private String leadId;                 // user_lead_profile.id
        private String toUserId;
    }
}
