package vacademy.io.admin_core_service.features.course_settings.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class DripConditionSettingsDTO {
        private Boolean enabled;
        private List<DripConditionItemDTO> conditions;
}
