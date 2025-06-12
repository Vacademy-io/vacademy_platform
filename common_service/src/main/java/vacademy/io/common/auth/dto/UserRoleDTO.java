package vacademy.io.common.auth.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.common.auth.entity.UserRole;

import java.util.Objects;

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

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof UserRoleDTO)) return false;
        UserRoleDTO that = (UserRoleDTO) o;
        return Objects.equals(roleName, that.roleName);
    }

    @Override
    public int hashCode() {
        return Objects.hash(roleName);
    }
}
