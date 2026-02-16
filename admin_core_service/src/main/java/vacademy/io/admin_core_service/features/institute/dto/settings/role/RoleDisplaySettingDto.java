package vacademy.io.admin_core_service.features.institute.dto.settings.role;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

import java.util.HashMap;
import java.util.Map;

@Getter
@Setter
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class RoleDisplaySettingDto {
    private Map<String, RoleDisplayConfigDto> roleSettings = new HashMap<>();
}
