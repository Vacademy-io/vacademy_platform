package vacademy.io.admin_core_service.features.institute.dto.settings.custom_field;


import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.institute.constants.ConstantsSettingDefaultValue;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Data
@AllArgsConstructor
@Builder
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CustomFieldSettingRequest {
    List<String> groupNames;
    List<String> customFieldsName;
    List<String> compulsoryCustomFields;
    Map<String, CustomFieldDto> customGroup;
    List<CustomFieldDto> customFieldsAndGroups;
    List<String> fixedCustomFields;
    List<String> allCustomFields;
    List<String> customFieldLocations;
    List<FixedFieldRenameDto> fixedFieldRenameDtos;
}
