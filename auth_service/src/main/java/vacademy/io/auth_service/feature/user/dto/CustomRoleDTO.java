package vacademy.io.auth_service.feature.user.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.auth_service.feature.user.dto.PermissionDTO; // Assuming PermissionDTO exists
import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class CustomRoleDTO {
    private String id;
    private String name;
    private String instituteId;
    private List<PermissionDTO> permissions;
}
