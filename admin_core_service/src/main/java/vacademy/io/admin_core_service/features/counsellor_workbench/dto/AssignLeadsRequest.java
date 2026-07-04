package vacademy.io.admin_core_service.features.counsellor_workbench.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Request body for /assign and /assign/preview — bulk-assign a caller-selected
 * set of leads (e.g. the multi-selected UNASSIGNED rows in the campaign-users /
 * leads list) to counsellor(s). Unlike {@link ReassignRequest} this is NOT scoped
 * to a source counsellor; it operates on an explicit list of lead {@code userIds}
 * (which may not yet have a user_lead_profile — the assign path creates one).
 *
 * mode = SINGLE       → target_user_id required; every selected lead goes to it.
 * mode = ROUND_ROBIN  → leads spread across candidate_user_ids in a cycle. When
 *                       candidate_user_ids is omitted, all active counsellors in
 *                       the leads team subtree are used (the UI pre-checks them
 *                       all and lets the admin deselect some).
 * mode = MANUAL       → assignments list required; each lead mapped to its
 *                       explicit target (the preview-with-overrides flow).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AssignLeadsRequest {

    private String instituteId;

    /** Lead user ids to assign (WorkbenchLead/campaign-user user_id values). */
    private List<String> userIds;

    private String mode;                       // SINGLE | ROUND_ROBIN | MANUAL

    private String targetUserId;               // SINGLE mode

    /** ROUND_ROBIN participants. Null/empty → all active counsellors in scope. */
    private List<String> candidateUserIds;

    private List<Assignment> assignments;      // MANUAL mode

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class Assignment {
        private String userId;                 // lead user_id
        private String toUserId;               // target counsellor
    }
}
