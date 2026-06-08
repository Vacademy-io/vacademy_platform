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
 * One position in a team's reporting tree. The chart endpoint returns the
 * roots of a team's tree (people with no manager inside that team), each
 * carrying their reports as nested children.
 *
 * userId is the auth user reference; the UI looks up display name / system
 * role / email fresh from auth_service so any role change on the user
 * record reflects immediately, without touching the org chart.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class OrgChartNodeDTO {
    private String mappingId;
    private String teamId;
    private String userId;
    private String parentUserId;
    private String roleLabel;

    @Builder.Default
    private List<OrgChartNodeDTO> children = new ArrayList<>();
}
