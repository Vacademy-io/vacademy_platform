package vacademy.io.admin_core_service.features.counselor_pool.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PoolMemberDTO {

    private String id;

    @JsonProperty("pool_id")
    private String poolId;

    @JsonProperty("audience_id")
    private String audienceId;

    @JsonProperty("counselor_user_id")
    private String counselorUserId;

    @JsonProperty("display_order")
    private Integer displayOrder;

    @JsonProperty("monthly_target")
    private Integer monthlyTarget;

    private String status;

    @JsonProperty("backup_counselor_user_id")
    private String backupCounselorUserId;

    @JsonProperty("added_by")
    private String addedBy;

    @JsonProperty("added_at")
    private Timestamp addedAt;

    @JsonProperty("updated_at")
    private Timestamp updatedAt;
}
