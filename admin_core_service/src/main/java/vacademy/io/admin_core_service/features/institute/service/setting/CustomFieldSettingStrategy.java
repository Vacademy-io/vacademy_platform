package vacademy.io.admin_core_service.features.institute.service.setting;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.institute.dto.settings.InstituteSettingDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.SettingDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.custom_field.CustomFieldDataDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.custom_field.CustomFieldDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.custom_field.CustomFieldSettingDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.custom_field.CustomFieldSettingRequest;
import vacademy.io.admin_core_service.features.institute.enums.SettingKeyEnums;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Slf4j
@Service
public class CustomFieldSettingStrategy extends IInstituteSettingStrategy {

    private static final String CUSTOM_FIELD_SETTING_NAME = "Custom Field Setting";
    private static final String DELETED_STATUS = StatusEnum.DELETED.name();

    @Override
    public String buildInstituteSetting(Institute institute, Object settingRequest) {
        setKey(SettingKeyEnums.CUSTOM_FIELD_SETTING.name());

        String settingJsonString = institute.getSetting();
        if (Objects.isNull(settingJsonString))
            return handleCaseWhereNoSettingPresent(institute, settingRequest);

        return handleCaseWhereInstituteSettingPresent(institute, settingRequest);
    }

    private String handleCaseWhereInstituteSettingPresent(Institute institute, Object settingRequest) {
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            CustomFieldSettingRequest customFieldSettingRequest = (CustomFieldSettingRequest) settingRequest;
            if (customFieldSettingRequest == null)
                throw new VacademyException("Invalid Request");

            // Parse the existing setting JSON string to Map
            InstituteSettingDto instituteSettingDto = objectMapper.readValue(
                    institute.getSetting(), InstituteSettingDto.class);

            Map<String, SettingDto> existingSettings = instituteSettingDto.getSetting();
            if (existingSettings == null)
                existingSettings = new HashMap<>();

            // Check if the Custom_field setting already exists
            if (existingSettings.containsKey(SettingKeyEnums.CUSTOM_FIELD_SETTING.name())) {
                // Just rebuild using rebuildInstituteSetting if already present
                return rebuildInstituteSetting(institute, customFieldSettingRequest,
                        SettingKeyEnums.NAMING_SETTING.name());
            }

            // Otherwise, create a new naming setting and add it
            CustomFieldDataDto data = createCustomFieldSettingFromRequest(customFieldSettingRequest);

            SettingDto settingDto = new SettingDto();
            settingDto.setKey(SettingKeyEnums.CUSTOM_FIELD_SETTING.name());
            settingDto.setName(CUSTOM_FIELD_SETTING_NAME);
            settingDto.setData(data);

            existingSettings.put(SettingKeyEnums.CUSTOM_FIELD_SETTING.name(), settingDto);
            instituteSettingDto.setSetting(existingSettings);

            return objectMapper.writeValueAsString(instituteSettingDto);
        } catch (Exception e) {
            throw new VacademyException("Error updating setting: " + e.getMessage());
        }
    }

    private CustomFieldDataDto createCustomFieldSettingFromRequest(
            CustomFieldSettingRequest customFieldSettingRequest) {
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
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            CustomFieldSettingRequest customFieldSettingRequest = (CustomFieldSettingRequest) settingRequest;
            if (customFieldSettingRequest == null)
                throw new VacademyException("Invalid Request");

            CustomFieldDataDto data = createCustomFieldSettingFromRequest(customFieldSettingRequest);

            InstituteSettingDto instituteSettingDto = new InstituteSettingDto();
            instituteSettingDto.setInstituteId(institute.getId());

            Map<String, SettingDto> settingMap = new HashMap<>();
            SettingDto settingDto = new SettingDto();
            settingDto.setKey(SettingKeyEnums.CUSTOM_FIELD_SETTING.name());
            settingDto.setName(CUSTOM_FIELD_SETTING_NAME);
            settingDto.setData(data);

            settingMap.put(SettingKeyEnums.CUSTOM_FIELD_SETTING.name(), settingDto);

            instituteSettingDto.setSetting(settingMap);

            return objectMapper.writeValueAsString(instituteSettingDto);
        } catch (Exception e) {
            throw new VacademyException("Error Creating Setting: " + e.getMessage());
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
                    institute.getSetting(), InstituteSettingDto.class);

            Map<String, SettingDto> settingMap = instituteSettingDto.getSetting();
            if (settingMap == null)
                throw new VacademyException("No Setting Found");

            if (!settingMap.containsKey(key)) {
                // Create new setting if it doesn't exist
                CustomFieldDataDto newData = createCustomFieldSettingFromRequest(new CustomFieldSettingRequest());
                SettingDto settingDto = new SettingDto();
                settingDto.setKey(SettingKeyEnums.CUSTOM_FIELD_SETTING.name());
                settingDto.setName(CUSTOM_FIELD_SETTING_NAME);
                settingDto.setData(newData);

                settingMap.put(key, settingDto);
                instituteSettingDto.setSetting(settingMap);
            } else {
                // Merge existing data with new request data (PATCH behavior)
                SettingDto existingSettingDto = settingMap.get(key);

                // Safely convert the data object to CustomFieldDataDto
                CustomFieldDataDto existingData = convertToCustomFieldDataDto(existingSettingDto.getData(),
                        objectMapper);

                // Merge the data instead of replacing
                CustomFieldDataDto mergedData = mergeCustomFieldSettings(existingData, customFieldSettingRequest);
                existingSettingDto.setData(mergedData);

                settingMap.put(key, existingSettingDto);
                instituteSettingDto.setSetting(settingMap);
            }

            return objectMapper.writeValueAsString(instituteSettingDto);
        } catch (Exception e) {
            throw new VacademyException("Error rebuilding setting: " + e.getMessage());
        }
    }

    /**
     * Safely converts a data object to CustomFieldDataDto
     * Handles cases where Jackson deserializes JSON into LinkedHashMap instead of
     * DTO
     */
    private CustomFieldDataDto convertToCustomFieldDataDto(Object data, ObjectMapper objectMapper) {
        try {
            if (data == null) {
                return new CustomFieldDataDto();
            }

            if (data instanceof CustomFieldDataDto customFieldDataDto) {
                return customFieldDataDto;
            }

            // Convert LinkedHashMap or other Map to CustomFieldDataDto using Jackson
            return objectMapper.convertValue(data, CustomFieldDataDto.class);
        } catch (Exception e) {
            // If conversion fails, log the error and return a new empty DTO
            log.error("Error converting data to CustomFieldDataDto: {}", e.getMessage());
            return new CustomFieldDataDto();
        }
    }

    /**
     * Merges existing custom field settings with new request data (PATCH behavior)
     * Only updates fields that are provided in the request, leaves others unchanged
     * Also filters out custom fields with DELETED status
     */
    private CustomFieldDataDto mergeCustomFieldSettings(CustomFieldDataDto existingData,
            CustomFieldSettingRequest request) {
        CustomFieldSettingDto existingSettings = existingData.getData();
        if (existingSettings == null) {
            existingSettings = new CustomFieldSettingDto();
        }

        // Merge only provided fields from request
        if (request.getAllCustomFields() != null) {
            existingSettings.setAllCustomFields(request.getAllCustomFields());
        }

        if (request.getCustomFieldLocations() != null) {
            existingSettings.setCustomFieldLocations(request.getCustomFieldLocations());
        }

        if (request.getCustomFieldsAndGroups() != null) {
            // Filter out deleted fields from custom fields and groups
            List<CustomFieldDto> filteredFields = request.getCustomFieldsAndGroups().stream()
                    .filter(field -> !DELETED_STATUS.equals(field.getStatus()))
                    .toList();
            existingSettings.setCurrentCustomFieldsAndGroups(filteredFields);
        }

        if (request.getFixedCustomFields() != null) {
            existingSettings.setFixedCustomFields(request.getFixedCustomFields());
        }

        if (request.getFixedFieldRenameDtos() != null) {
            existingSettings.setFixedFieldRenameDtos(request.getFixedFieldRenameDtos());
        }

        if (request.getGroupNames() != null) {
            existingSettings.setGroupNames(request.getGroupNames());
        }

        if (request.getCustomFieldsName() != null) {
            existingSettings.setCustomFieldsNames(request.getCustomFieldsName());
        }

        if (request.getCompulsoryCustomFields() != null) {
            existingSettings.setCompulsoryCustomFields(request.getCompulsoryCustomFields());
        }

        if (request.getCustomGroup() != null) {
            // Filter out deleted fields from custom group
            Map<String, CustomFieldDto> filteredCustomGroup = request.getCustomGroup().entrySet().stream()
                    .filter(entry -> !DELETED_STATUS.equals(entry.getValue().getStatus()))
                    .collect(Collectors.toMap(
                            Map.Entry::getKey,
                            Map.Entry::getValue));
            existingSettings.setCustomGroup(filteredCustomGroup);
        }

        // Clean up all collections to remove references to deleted fields
        cleanupDeletedFieldsFromSettings(existingSettings);

        CustomFieldDataDto mergedDataDto = new CustomFieldDataDto();
        mergedDataDto.setData(existingSettings);
        return mergedDataDto;
    }

    /**
     * Removes references to deleted custom fields from all settings collections
     */
    private void cleanupDeletedFieldsFromSettings(CustomFieldSettingDto settings) {
        if (settings.getCurrentCustomFieldsAndGroups() != null) {
            List<CustomFieldDto> activeFields = settings.getCurrentCustomFieldsAndGroups().stream()
                    .filter(field -> !DELETED_STATUS.equals(field.getStatus()))
                    .toList();
            settings.setCurrentCustomFieldsAndGroups(activeFields);
        }

        if (settings.getCustomGroup() != null) {
            Map<String, CustomFieldDto> activeCustomGroup = settings.getCustomGroup().entrySet().stream()
                    .filter(entry -> !DELETED_STATUS.equals(entry.getValue().getStatus()))
                    .collect(Collectors.toMap(
                            Map.Entry::getKey,
                            Map.Entry::getValue));
            settings.setCustomGroup(activeCustomGroup);
        }

        // Update allCustomFields to only include active fields
        if (settings.getCurrentCustomFieldsAndGroups() != null) {
            List<String> activeFieldIds = settings.getCurrentCustomFieldsAndGroups().stream()
                    .map(CustomFieldDto::getCustomFieldId)
                    .filter(Objects::nonNull)
                    .toList();
            settings.setAllCustomFields(activeFieldIds);
        }

        // Update compulsoryCustomFields to only include active fields
        if (settings.getCompulsoryCustomFields() != null && settings.getAllCustomFields() != null) {
            List<String> activeCompulsoryFields = settings.getCompulsoryCustomFields().stream()
                    .filter(fieldId -> settings.getAllCustomFields().contains(fieldId))
                    .toList();
            settings.setCompulsoryCustomFields(activeCompulsoryFields);
        }

        // Update fixedCustomFields to only include active fields
        if (settings.getFixedCustomFields() != null && settings.getAllCustomFields() != null) {
            List<String> activeFixedFields = settings.getFixedCustomFields().stream()
                    .filter(fieldId -> settings.getAllCustomFields().contains(fieldId))
                    .toList();
            settings.setFixedCustomFields(activeFixedFields);
        }
    }
}
