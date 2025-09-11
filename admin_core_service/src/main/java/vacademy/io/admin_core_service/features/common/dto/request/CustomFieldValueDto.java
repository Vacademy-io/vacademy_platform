package vacademy.io.admin_core_service.features.common.dto.request;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CustomFieldValueDto {
    private String customFieldId;
    private String sourceType;
    private String sourceId;
    private String type;
    private String typeId;
    private String value;
}
