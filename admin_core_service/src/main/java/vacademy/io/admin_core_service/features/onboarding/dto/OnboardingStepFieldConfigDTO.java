package vacademy.io.admin_core_service.features.onboarding.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class OnboardingStepFieldConfigDTO {
    private String id;
    /** Existing institute_custom_fields.id to attach; omit and set newField to create one inline. */
    private String instituteCustomFieldId;
    /** Inline field creation: {field_name, field_type, default_value, config}. Ignored if instituteCustomFieldId is set. */
    private java.util.Map<String, Object> newField;
    private Integer fieldOrder;
    private Boolean isMandatory;
    private Boolean isHidden;
    private List<OnboardingRoleAccessDTO> roleAccess;
}
