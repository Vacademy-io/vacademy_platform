package vacademy.io.admin_core_service.features.institute.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute.constants.ConstantsSettingDefaultValue;
import vacademy.io.admin_core_service.features.institute.dto.settings.InstituteSettingDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.naming.NamePreferenceSettingDataDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.naming.NameSettingRequest;
import vacademy.io.admin_core_service.features.institute.dto.settings.naming.NamingSettingDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.SettingDto;
import vacademy.io.admin_core_service.features.institute.enums.SettingKeyEnums;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class NameSettingStrategy extends IInstituteSettingStrategy{


    @Override
    public String buildInstituteSetting(Institute institute, Object settingRequest) {
        setKey(SettingKeyEnums.NAMING_SETTING.name());

        String settingJsonString = institute.getSetting();
        if(Objects.isNull(settingJsonString)) return handleCaseWhereNoSettingPresent(institute, settingRequest);
        return handleCaseWhereInstituteSettingPresent(institute, settingRequest);
    }

    private String handleCaseWhereInstituteSettingPresent(Institute institute, Object settingRequest) {
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            NameSettingRequest nameSettingRequest = (NameSettingRequest) settingRequest;
            if (nameSettingRequest == null) throw new VacademyException("Invalid Request");

            // Parse the existing setting JSON string to Map
            InstituteSettingDto instituteSettingDto = objectMapper.readValue(
                    institute.getSetting(), InstituteSettingDto.class
            );

            Map<String, SettingDto> existingSettings = instituteSettingDto.getSetting();
            if (existingSettings == null) existingSettings = new HashMap<>();

            // Check if the naming setting already exists
            if (existingSettings.containsKey(SettingKeyEnums.NAMING_SETTING.name())) {
                // Just rebuild using rebuildInstituteSetting if already present
                return rebuildInstituteSetting(institute, nameSettingRequest, SettingKeyEnums.NAMING_SETTING.name());
            }

            // Otherwise, create a new naming setting and add it
            NamePreferenceSettingDataDto data = createNamingDataFromRequest(nameSettingRequest);

            SettingDto settingDto = new SettingDto();
            settingDto.setKey(SettingKeyEnums.NAMING_SETTING.name());
            settingDto.setName("Naming Setting");
            settingDto.setData(data);

            existingSettings.put(SettingKeyEnums.NAMING_SETTING.name(), settingDto);
            instituteSettingDto.setSetting(existingSettings);

            return objectMapper.writeValueAsString(instituteSettingDto);
        } catch (Exception e) {
            throw new VacademyException("Error updating setting: " + e.getMessage());
        }
    }

    private String handleCaseWhereNoSettingPresent(Institute institute, Object settingRequest) {
        try{
            ObjectMapper objectMapper = new ObjectMapper();
            NameSettingRequest nameSettingRequest = (NameSettingRequest) settingRequest;
            if(nameSettingRequest==null) throw new VacademyException("Invalid Request");

            NamePreferenceSettingDataDto data = createNamingDataFromRequest(nameSettingRequest);


            InstituteSettingDto instituteSettingDto = new InstituteSettingDto();
            instituteSettingDto.setInstituteId(institute.getId());

            Map<String, SettingDto> settingMap = new HashMap<>();
            SettingDto settingDto = new SettingDto();
            settingDto.setKey(SettingKeyEnums.NAMING_SETTING.name());
            settingDto.setName("Naming Setting");
            settingDto.setData(data);

            settingMap.put(SettingKeyEnums.NAMING_SETTING.name(), settingDto);

            instituteSettingDto.setSetting(settingMap);

            return objectMapper.writeValueAsString(instituteSettingDto);
        } catch (Exception e) {
            throw new VacademyException("Error Creating Setting: " +e.getMessage());
        }
    }

    private NamePreferenceSettingDataDto createNamingDataFromRequest(NameSettingRequest nameSettingRequest) {
        List<NamingSettingDto> namingSettings = nameSettingRequest.getNameRequest().entrySet().stream()
                .map(entry -> {
                    NamingSettingDto dto = new NamingSettingDto();
                    dto.setKey(entry.getKey());
                    dto.setSystemValue(ConstantsSettingDefaultValue.getNameSystemValueForKey(entry.getKey())); // assuming system value is same as key
                    dto.setCustomValue(entry.getValue());
                    return dto;
                })
                .collect(Collectors.toList());

        NamePreferenceSettingDataDto namePreferenceSettingDataDto = new NamePreferenceSettingDataDto();
        namePreferenceSettingDataDto.setData(namingSettings);
        return namePreferenceSettingDataDto;
    }

    @Override
    public String rebuildInstituteSetting(Institute institute, Object settingRequest, String key) {
        setKey(SettingKeyEnums.NAMING_SETTING.name());
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            NameSettingRequest nameSettingRequest = (NameSettingRequest) settingRequest;
            if (nameSettingRequest == null) throw new VacademyException("Invalid Request");

            // Parse existing settings
            InstituteSettingDto instituteSettingDto = objectMapper.readValue(
                    institute.getSetting(), InstituteSettingDto.class
            );

            Map<String, SettingDto> settingMap = instituteSettingDto.getSetting();
            if (settingMap == null) throw new VacademyException("No Setting Found");

            if (!settingMap.containsKey(key)) {
                throw new VacademyException("Naming Setting Not Found");
            }

            // Update existing setting data
            NamePreferenceSettingDataDto newData = createNamingDataFromRequest(nameSettingRequest);

            SettingDto settingDto = settingMap.get(key);
            settingDto.setData(newData);

            // Replace and return updated JSON
            settingMap.put(key, settingDto);
            instituteSettingDto.setSetting(settingMap);

            return objectMapper.writeValueAsString(instituteSettingDto);
        } catch (Exception e) {
            throw new VacademyException("Error rebuilding setting: " + e.getMessage());
        }
    }
}
