package vacademy.io.admin_core_service.features.counselor_pool.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Flip a counselor's status inside a pool. Applies to ALL of that counselor's
 * rows for that pool (across audiences).
 *
 * When marking INACTIVE, a backup_counselor_user_id is required so the routing
 * engine knows where to redirect leads. When marking ACTIVE, backup is cleared.
 *
 * reassign_existing_leads (INACTIVE only) controls whether existing OPEN leads
 * already assigned to this counselor — scoped to the audiences in THIS pool —
 * are also moved to the backup. When the counselor later becomes ACTIVE again,
 * the transferred leads stay with the backup; no rollback or history.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateMemberStatusRequest {

    /** ACTIVE | INACTIVE */
    private String status;

    /** Required when status = INACTIVE. Ignored when status = ACTIVE. */
    @JsonProperty("backup_counselor_user_id")
    private String backupCounselorUserId;

    /**
     * INACTIVE only. When true, also reassign the counselor's currently open
     * (conversion_status = LEAD) leads, scoped to this pool's audiences, to
     * the backup. Default false → only NEW leads will route to the backup.
     */
    @JsonProperty("reassign_existing_leads")
    @Builder.Default
    private Boolean reassignExistingLeads = false;
}
