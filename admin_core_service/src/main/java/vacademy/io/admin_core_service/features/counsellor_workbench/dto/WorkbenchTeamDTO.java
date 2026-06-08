package vacademy.io.admin_core_service.features.counsellor_workbench.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Result of GET /me/team. The caller's home team (= the team within the
 * leads_team_id subtree they belong to) plus the breadcrumb chain.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class WorkbenchTeamDTO {
    private String teamId;
    private String teamName;
    private String leadsRootTeamId;
    private List<String> ancestorNames;   // root → … → parent of team
    private List<String> descendantTeamIds;
}
