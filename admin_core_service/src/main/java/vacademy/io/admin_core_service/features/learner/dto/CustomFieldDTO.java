package vacademy.io.admin_core_service.features.learner.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for custom field with key-value pair and metadata
 * Used in student mapping response to show user's custom field data
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CustomFieldDTO {
    private String customFieldId;
    private String fieldKey;
    private String fieldName;
    private String fieldType;
    private String fieldValue;
    private String sourceType;
}
