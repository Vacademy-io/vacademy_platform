package vacademy.io.common.auth.dto.organization;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AddMemberRequest {
    private String userId;
    private String roleName;     // STUDENT is rejected
    private String roleLabel;
    private Boolean isTeamHead;
}
