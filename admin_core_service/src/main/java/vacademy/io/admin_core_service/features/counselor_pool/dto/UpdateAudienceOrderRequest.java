package vacademy.io.admin_core_service.features.counselor_pool.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Replace the rotation order for one (pool, audience). The list must contain
 * every existing member's user_id in the desired order — no extras, no missing.
 * Backend assigns display_order = 1..N based on position.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateAudienceOrderRequest {

    @JsonProperty("counselor_user_ids")
    private List<String> counselorUserIds;
}
