package vacademy.io.common.auth.dto.organization;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;

/**
 * One membership row: (team, user) plus the user-to-user reporting line
 * INSIDE that team.
 *
 * <ul>
 *   <li>{@code userId} — the auth user this membership belongs to.</li>
 *   <li>{@code parentUserId} — who they report to inside this team. NULL
 *       means they are at the top of this team (no manager in this team).</li>
 *   <li>{@code roleLabel} — friendly position title, e.g. "Tech Lead",
 *       "BDM". Optional. Distinct from the system role on the user record,
 *       which the UI fetches fresh and renders alongside.</li>
 * </ul>
 *
 * The legacy {@code roleName} and {@code isTeamHead} fields stay in the DB
 * but are not exposed here — UI never depends on them.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class TeamMemberDTO {
    private String mappingId;
    private String teamId;
    private String userId;
    /** Their manager inside this team. NULL = head of this team. */
    private String parentUserId;
    private String roleLabel;
    private String status;
    private Timestamp addedAt;
}
