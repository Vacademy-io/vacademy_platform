package vacademy.io.admin_core_service.features.counselor_pool.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Time;
import java.sql.Timestamp;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PoolShiftDTO {

    private String id;

    @JsonProperty("pool_id")
    private String poolId;

    @JsonProperty("day_of_week")
    private String dayOfWeek;

    @JsonProperty("start_time")
    private Time startTime;

    @JsonProperty("end_time")
    private Time endTime;

    private String label;

    private String status;

    @JsonProperty("created_at")
    private Timestamp createdAt;

    @JsonProperty("updated_at")
    private Timestamp updatedAt;

    /** Counselors on this shift. */
    private List<PoolShiftMemberDTO> members;
}
