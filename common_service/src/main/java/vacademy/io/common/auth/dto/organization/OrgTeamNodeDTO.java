package vacademy.io.common.auth.dto.organization;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * Nested tree projection returned by GET /organization-team/chart. Each node
 * carries the same key fields as OrgTeamDTO plus its direct children.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class OrgTeamNodeDTO {
    private String id;
    private String parentId;
    private String name;
    private String description;
    private String headUserId;
    private Integer sortOrder;
    private Long memberCount;

    @Builder.Default
    private List<OrgTeamNodeDTO> children = new ArrayList<>();

    /**
     * Members of this team. Populated only by /chart-with-members; the plain
     * /chart endpoint leaves this null so existing callers see no payload
     * difference. Used by the org-chart "Tree view" mode in the UI.
     */
    private List<TeamMemberDTO> members;
}
