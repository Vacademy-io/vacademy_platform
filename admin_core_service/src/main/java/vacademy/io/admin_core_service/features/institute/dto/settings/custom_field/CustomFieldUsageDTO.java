package vacademy.io.admin_core_service.features.institute.dto.settings.custom_field;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.common.dto.CustomFieldDTO;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CustomFieldUsageDTO {
    private CustomFieldDTO customField;
    private boolean isDefault;
    private long enrollInviteCount;
    private long audienceCount;
}
