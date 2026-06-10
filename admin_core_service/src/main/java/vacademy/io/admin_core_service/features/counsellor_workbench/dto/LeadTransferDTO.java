package vacademy.io.admin_core_service.features.counsellor_workbench.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;

/**
 * One entry in a lead's counsellor-assignment chain. Sourced from
 * timeline_event rows where type=USER_LEAD_PROFILE and
 * action_type=COUNSELOR_ASSIGNED. The first assignment has
 * {@code fromUserId == null}; subsequent rows have the previous counsellor.
 *
 * Names are hydrated in the service layer via auth_service — admin_core can't
 * JOIN to users directly on stage/prod (separate Postgres DBs).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LeadTransferDTO {
    /** Previous counsellor's user_id. Null for the initial assignment. */
    private String fromUserId;
    private String fromName;
    /** New counsellor's user_id (always populated). */
    private String toUserId;
    private String toName;
    /** Who performed the reassign. May be the system for pool / RR assignments. */
    private String actorId;
    private String actorName;
    /** Workbench-side trigger tag: WORKBENCH_REASSIGN, POOL_ASSIGNMENT, etc. */
    private String trigger;
    /** Mode tag for workbench reassigns: SINGLE / ROUND_ROBIN / MANUAL. */
    private String mode;
    private Timestamp at;
}
