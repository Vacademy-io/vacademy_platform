package vacademy.io.common.auth.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.common.auth.entity.UserRole;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Data
public class UserRoleDTO {
    private String roleName;
    private String status;
    private String roleId;

    public UserRoleDTO(UserRole userRole) {
        this.roleName = userRole.getRole().getName();
        this.status = userRole.getStatus();
        this.roleId = userRole.getRole().getId();
    }
}
