package vacademy.io.admin_core_service.features.counselor_pool.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Attach one or more audiences (campaigns) to a pool in a single call. Each
 * audience seeds member rows for every existing pool member. The whole batch is
 * atomic — if any id fails (e.g. already attached to another pool), nothing is
 * added.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AddAudiencesRequest {

    @JsonProperty("audience_ids")
    private List<String> audienceIds;
}
