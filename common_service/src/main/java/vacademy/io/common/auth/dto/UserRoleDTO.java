package vacademy.io.common.auth.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.common.auth.entity.UserRole;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Data
@NoArgsConstructor
public class UserRoleDTO {
    private String id;
    private String instituteId;
    private String roleName;
    private String status;
    private String roleId;

    public UserRoleDTO(UserRole userRole) {
        this.roleName = userRole.getRole().getName();
        this.status = userRole.getStatus();
        this.roleId = userRole.getRole().getId();
        this.id = userRole.getId();
        this.instituteId = userRole.getInstituteId();
    }
}
