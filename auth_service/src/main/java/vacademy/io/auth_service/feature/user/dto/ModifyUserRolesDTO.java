package vacademy.io.auth_service.feature.user.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class ModifyUserRolesDTO {
    private String commaSeparatedRoleIds;
    private String userId;
    private String instituteId;
}
