package vacademy.io.common.auth.dto.organization;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;

/**
 * One team in an institute. Teams are flat — there is no sub-team hierarchy
 * in this design. The reporting structure lives INSIDE a team and is
 * captured per-membership via {@link TeamMemberDTO#getParentUserId()}.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class OrgTeamDTO {
    private String id;
    private String instituteId;
    private String name;
    private String description;
    private String status;
    /** Convenience: how many ACTIVE memberships this team has. */
    private Long memberCount;
    private Timestamp createdAt;
    private Timestamp updatedAt;
}
