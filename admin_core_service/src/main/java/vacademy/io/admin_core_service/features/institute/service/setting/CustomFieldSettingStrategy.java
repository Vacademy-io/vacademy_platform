package vacademy.io.admin_core_service.features.institute.service.setting;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute.dto.settings.InstituteSettingDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.SettingDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.custom_field.CustomFieldDataDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.custom_field.CustomFieldSettingDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.custom_field.CustomFieldSettingRequest;
import vacademy.io.admin_core_service.features.institute.enums.SettingKeyEnums;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

@Service
public class CustomFieldSettingStrategy extends IInstituteSettingStrategy{
    @Override
    public String buildInstituteSetting(Institute institute, Object settingRequest) {
        setKey(SettingKeyEnums.CUSTOM_FIELD_SETTING.name());

        String settingJsonString = institute.getSetting();
        if(Objects.isNull(settingJsonString)) return handleCaseWhereNoSettingPresent(institute, settingRequest);

        return handleCaseWhereInstituteSettingPresent(institute, settingRequest);
    }

    private String handleCaseWhereInstituteSettingPresent(Institute institute, Object settingRequest) {
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            CustomFieldSettingRequest customFieldSettingRequest = (CustomFieldSettingRequest) settingRequest;
            if (customFieldSettingRequest == null) throw new VacademyException("Invalid Request");

            // Parse the existing setting JSON string to Map
            InstituteSettingDto instituteSettingDto = objectMapper.readValue(
                    institute.getSetting(), InstituteSettingDto.class
            );

            Map<String, SettingDto> existingSettings = instituteSettingDto.getSetting();
            if (existingSettings == null) existingSettings = new HashMap<>();

            // Check if the Custom_field setting already exists
            if (existingSettings.containsKey(SettingKeyEnums.CUSTOM_FIELD_SETTING.name())) {
                // Just rebuild using rebuildInstituteSetting if already present
                return rebuildInstituteSetting(institute, customFieldSettingRequest, SettingKeyEnums.NAMING_SETTING.name());
            }

            // Otherwise, create a new naming setting and add it
            CustomFieldDataDto data = createCustomFieldSettingFromRequest(customFieldSettingRequest);

            SettingDto settingDto = new SettingDto();
            settingDto.setKey(SettingKeyEnums.CUSTOM_FIELD_SETTING.name());
            settingDto.setName("Custom Field Setting");
            settingDto.setData(data);

            existingSettings.put(SettingKeyEnums.CUSTOM_FIELD_SETTING.name(), settingDto);
            instituteSettingDto.setSetting(existingSettings);

            return objectMapper.writeValueAsString(instituteSettingDto);
        } catch (Exception e) {
            throw new VacademyException("Error updating setting: " + e.getMessage());
        }
    }

    private CustomFieldDataDto createCustomFieldSettingFromRequest(CustomFieldSettingRequest customFieldSettingRequest) {
        CustomFieldSettingDto data = new CustomFieldSettingDto();
        data.setAllCustomFields(customFieldSettingRequest.getAllCustomFields());
        data.setCustomFieldLocations(customFieldSettingRequest.getCustomFieldLocations());
        data.setCurrentCustomFieldsAndGroups(customFieldSettingRequest.getCustomFieldsAndGroups());
        data.setFixedCustomFields(customFieldSettingRequest.getFixedCustomFields());
        data.setFixedFieldRenameDtos(customFieldSettingRequest.getFixedFieldRenameDtos());
        data.setGroupNames(customFieldSettingRequest.getGroupNames());
        data.setCustomFieldsNames(customFieldSettingRequest.getCustomFieldsName());
        data.setCompulsoryCustomFields(customFieldSettingRequest.getCompulsoryCustomFields());
        data.setCustomGroup(customFieldSettingRequest.getCustomGroup());

        CustomFieldDataDto dataDto = new CustomFieldDataDto();
        dataDto.setData(data);
        return dataDto;
    }

    private String handleCaseWhereNoSettingPresent(Institute institute, Object settingRequest) {
        try{
            ObjectMapper objectMapper = new ObjectMapper();
            CustomFieldSettingRequest customFieldSettingRequest = (CustomFieldSettingRequest) settingRequest;
            if(customFieldSettingRequest==null) throw new VacademyException("Invalid Request");

            CustomFieldDataDto data = createCustomFieldSettingFromRequest(customFieldSettingRequest);


            InstituteSettingDto instituteSettingDto = new InstituteSettingDto();
            instituteSettingDto.setInstituteId(institute.getId());

            Map<String, SettingDto> settingMap = new HashMap<>();
            SettingDto settingDto = new SettingDto();
            settingDto.setKey(SettingKeyEnums.CUSTOM_FIELD_SETTING.name());
            settingDto.setName("Custom Field Setting");
            settingDto.setData(data);

            settingMap.put(SettingKeyEnums.CUSTOM_FIELD_SETTING.name(), settingDto);

            instituteSettingDto.setSetting(settingMap);

            return objectMapper.writeValueAsString(instituteSettingDto);
        } catch (Exception e) {
            throw new VacademyException("Error Creating Setting: " +e.getMessage());
        }
    }

    @Override
    public String rebuildInstituteSetting(Institute institute, Object settingRequest, String key) {
        setKey(SettingKeyEnums.CUSTOM_FIELD_SETTING.name());
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            CustomFieldSettingRequest customFieldSettingRequest = (CustomFieldSettingRequest) settingRequest;

            // Parse existing settings
            InstituteSettingDto instituteSettingDto = objectMapper.readValue(
                    institute.getSetting(), InstituteSettingDto.class
            );

            Map<String, SettingDto> settingMap = instituteSettingDto.getSetting();
            if (settingMap == null) throw new VacademyException("No Setting Found");

            CustomFieldDataDto newData = null;

            if (!settingMap.containsKey(key)) {
                newData = createCustomFieldSettingFromRequest(new CustomFieldSettingRequest());
                SettingDto settingDto = new SettingDto();
                settingDto.setKey(SettingKeyEnums.CUSTOM_FIELD_SETTING.name());
                settingDto.setName("Custom Field Setting");
                settingDto.setData(newData);

                // Replace and return updated JSON
                settingMap.put(key, settingDto);
                instituteSettingDto.setSetting(settingMap);
            }
            else{
                newData = createCustomFieldSettingFromRequest(customFieldSettingRequest);
                SettingDto settingDto = settingMap.get(key);
                settingDto.setData(newData);

                // Replace and return updated JSON
                settingMap.put(key, settingDto);
                instituteSettingDto.setSetting(settingMap);
            }

            return objectMapper.writeValueAsString(instituteSettingDto);
        } catch (Exception e) {
            throw new VacademyException("Error rebuilding setting: " + e.getMessage());
        }
    }
}
