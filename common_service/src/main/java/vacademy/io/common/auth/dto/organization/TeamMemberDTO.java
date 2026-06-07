package vacademy.io.common.auth.dto.organization;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class TeamMemberDTO {
    private String mappingId;
    private String teamId;
    private String userId;
    private String roleName;
    private String roleLabel;
    private Boolean isTeamHead;
    private String status;
    private Timestamp addedAt;
}
