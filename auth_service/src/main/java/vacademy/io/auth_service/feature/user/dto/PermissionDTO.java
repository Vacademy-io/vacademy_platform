package vacademy.io.auth_service.feature.user.dto;


import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;


@Data
@NoArgsConstructor
@AllArgsConstructor
public class PermissionDTO {
    private String permissionId;
    private String permissionName;
    private String tag;
}
