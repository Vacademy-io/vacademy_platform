package vacademy.io.admin_core_service.features.counselor_pool.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Payload for creating a new counselor pool. Audiences and counselors are
 * optional at create time — admin can add them later via separate endpoints.
 *
 * If audiences and counselors are both provided, the service will create one
 * counselor_pool_member row per (audience, counselor) pair with sequential
 * display_order matching the counselor list order.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreatePoolRequest {

    @JsonProperty("institute_id")
    private String instituteId;

    private String name;

    private String description;

    /** MANUAL | ROUND_ROBIN | TIME_BASED */
    @JsonProperty("assignment_mode")
    private String assignmentMode;

    /**
     * Optional: PER_DAY | SAME_HOURS_ALL_DAYS. Drives the schedule editor used
     * by the UI. Defaults to PER_DAY when omitted. Only meaningful for
     * TIME_BASED pools but accepted on any pool for forward compatibility.
     */
    @JsonProperty("schedule_pattern")
    private String schedulePattern;

    /** Optional: campaigns to link at creation. */
    @JsonProperty("audience_ids")
    private List<String> audienceIds;

    /** Optional: counselors to include at creation. Order in this list seeds display_order. */
    @JsonProperty("counselor_user_ids")
    private List<String> counselorUserIds;
}
