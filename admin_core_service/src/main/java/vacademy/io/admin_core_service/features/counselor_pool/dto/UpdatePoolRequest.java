package vacademy.io.admin_core_service.features.counselor_pool.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Edit a pool's metadata. Membership and audiences have their own endpoints. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdatePoolRequest {

    private String name;

    private String description;

    /** MANUAL | ROUND_ROBIN | TIME_BASED. Switching modes does NOT clear shifts or members. */
    @JsonProperty("assignment_mode")
    private String assignmentMode;
}
