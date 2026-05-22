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
public class PoolShiftMemberDTO {

    private String id;

    @JsonProperty("shift_id")
    private String shiftId;

    @JsonProperty("counselor_user_id")
    private String counselorUserId;

    private String status;

    @JsonProperty("added_at")
    private Timestamp addedAt;
}
