package vacademy.io.admin_core_service.features.counselor_pool.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Set a counsellor's monthly target per audience inside one pool.
 *
 * Targets are stored per (pool, audience, counsellor) row in counselor_pool_member
 * — i.e. one cell per audience. This DTO carries the entries the admin filled in
 * the "Set monthly targets" dialog for one counsellor. Each entry is applied
 * independently:
 *   - monthly_target = null    → clear the target for that (audience, counsellor)
 *   - monthly_target = 0..MAX  → set the target value
 *
 * Entries for audiences not in the pool (or for which the counsellor has no row)
 * are no-ops, by design — the UI only ever sends valid pairs.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateMemberMonthlyTargetsRequest {

    /** One entry per (audience, counsellor) cell the admin wants to update. */
    private List<TargetEntry> targets;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TargetEntry {

        @JsonProperty("audience_id")
        private String audienceId;

        /** null clears the target; non-null must be >= 0. */
        @JsonProperty("monthly_target")
        private Integer monthlyTarget;
    }
}
