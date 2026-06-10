package vacademy.io.common.auth.dto.organization;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

/**
 * Create a flat team. No parent_id — sub-teams are out of scope. The
 * reporting tree lives INSIDE the team via parent_user_id on each membership.
 */
@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CreateTeamRequest {
    private String instituteId;
    private String name;
    private String description;
}
