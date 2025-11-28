package vacademy.io.admin_core_service.features.audience.dto.combined;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for custom field with value
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CustomFieldDTO {

    private String customFieldId;
    private String fieldKey;
    private String fieldName;
    private String fieldType;
    private String value;
}
