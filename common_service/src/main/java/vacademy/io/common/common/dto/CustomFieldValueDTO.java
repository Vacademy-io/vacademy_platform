package vacademy.io.common.common.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CustomFieldValueDTO {
    private String customFieldId;
    private String sourceType;
    private String sourceId;
    private String type;
    private String typeId;
    private String value;
}
