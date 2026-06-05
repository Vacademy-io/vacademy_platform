package vacademy.io.admin_core_service.features.counselor_pool.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Add one or more counselors to a pool in a single call. Each counselor is
 * appended to the bottom of the rotation for every audience in the pool. The
 * whole batch is atomic — if any id fails, nothing is added.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AddCounselorsRequest {

    @JsonProperty("counselor_user_ids")
    private List<String> counselorUserIds;
}
