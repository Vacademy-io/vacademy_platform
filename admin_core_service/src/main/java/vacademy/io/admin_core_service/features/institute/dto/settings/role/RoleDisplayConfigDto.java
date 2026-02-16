package vacademy.io.admin_core_service.features.institute.dto.settings.role;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class RoleDisplayConfigDto {
    private String displayName;
    private String color;
    private String icon;
    private Boolean isVisible;
    private Boolean sidebarVisibility;
    private String postLoginRoute;
    private List<String> visibleColumns = new ArrayList<>();
}
