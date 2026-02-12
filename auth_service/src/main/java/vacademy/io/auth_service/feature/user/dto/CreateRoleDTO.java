package vacademy.io.auth_service.feature.user.dto;

import lombok.Data;
import java.util.List;

@Data
public class CreateRoleDTO {
    private String name;
    private List<String> permissionIds;
}
