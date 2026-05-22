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
}
