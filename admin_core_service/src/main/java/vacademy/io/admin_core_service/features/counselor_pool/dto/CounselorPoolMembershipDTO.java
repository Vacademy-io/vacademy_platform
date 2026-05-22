package vacademy.io.admin_core_service.features.counselor_pool.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One pool that a counselor belongs to, for the "manage this counselor across
 * pools" admin flow. The status is the pool-level status (ACTIVE iff every
 * audience row for this counselor in that pool is ACTIVE) — matches the
 * same rollup the CounselorsTab UI computes today.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CounselorPoolMembershipDTO {

    @JsonProperty("pool_id")
    private String poolId;

    @JsonProperty("pool_name")
    private String poolName;

    /** ACTIVE | INACTIVE — rollup across the counselor's rows in this pool. */
    private String status;
}
