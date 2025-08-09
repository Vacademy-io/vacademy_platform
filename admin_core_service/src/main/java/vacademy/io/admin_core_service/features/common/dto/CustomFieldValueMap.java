package vacademy.io.admin_core_service.features.common.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CustomFieldValueMap {
    private String customFieldId;
    private String value;
}
