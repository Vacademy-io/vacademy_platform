package vacademy.io.common.auth.dto.organization;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

/**
 * Add a person to a team. parent_user_id is the manager they will report
 * to INSIDE this team — null means top of the team.
 */
@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AddMemberRequest {
    private String userId;
    /** Their manager inside this team. Null = top of team. */
    private String parentUserId;
    /** Optional position title ("Tech Lead", "BDM"). */
    private String roleLabel;
}
