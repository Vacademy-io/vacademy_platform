package vacademy.io.admin_core_service.features.counselor_pool.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Flip a counselor's status across MULTIPLE pools in one transactional call.
 *
 * Same backup_counselor_user_id and reassign_existing_leads apply to every
 * pool in pool_ids. Any per-pool failure rolls back the whole batch
 * (all-or-nothing semantics — admin sees a single error toast and nothing
 * changed server-side).
 *
 * The lead-reassign scope stays per-pool: a lead is moved to the backup only
 * if it belongs to that specific pool's audiences, even when several pools
 * are updated in one request.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BulkUpdateMemberStatusRequest {

    @JsonProperty("pool_ids")
    private List<String> poolIds;

    /** ACTIVE | INACTIVE */
    private String status;

    /** Required when status = INACTIVE. Same backup is applied to every pool. */
    @JsonProperty("backup_counselor_user_id")
    private String backupCounselorUserId;

    /** INACTIVE only. Scoped per-pool: only this pool's open leads move. */
    @JsonProperty("reassign_existing_leads")
    @Builder.Default
    private Boolean reassignExistingLeads = false;
}
