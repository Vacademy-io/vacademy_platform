package vacademy.io.common.auth.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.Set;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Data
public class EditUserPermissionRequestDTO {
    private String userId;
    private String instituteId;
    private Set<String> addedPermissionIds;
    private Set<String> removedPermissionIds;
}
