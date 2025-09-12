package vacademy.io.admin_core_service.features.institute.dto.settings.custom_field;


import lombok.Getter;
import lombok.Setter;
import vacademy.io.admin_core_service.features.institute.constants.ConstantsSettingDefaultValue;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Getter
@Setter
public class CustomFieldSettingDto {
    List<String> groupNames = new ArrayList<>();
    List<String> customFieldsNames = new ArrayList<>();
    List<CustomFieldDto> currentCustomFieldsAndGroups = new ArrayList<>();
    Map<String, CustomFieldDto> customGroup = new HashMap<>();
    List<String> compulsoryCustomFields = new ArrayList<>();
    List<String> fixedCustomFields = new ArrayList<>();
    List<String> allCustomFields = new ArrayList<>();
    List<FixedFieldRenameDto> fixedFieldRenameDtos = new ArrayList<>();
    List<String> customFieldLocations = ConstantsSettingDefaultValue.getDefaultCustomFieldLocations();
}
