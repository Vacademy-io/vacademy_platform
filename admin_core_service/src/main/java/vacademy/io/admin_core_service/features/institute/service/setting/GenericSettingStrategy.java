package vacademy.io.admin_core_service.features.institute.service.setting;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute.dto.settings.GenericSettingRequest;
import vacademy.io.admin_core_service.features.institute.dto.settings.InstituteSettingDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.SettingDto;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

@Service
public class GenericSettingStrategy extends IInstituteSettingStrategy {

    @Override
    public String buildInstituteSetting(Institute institute, Object settingRequest) {
        String settingJsonString = institute.getSetting();
        if(Objects.isNull(settingJsonString)) return handleCaseWhereNoSettingPresent(institute, settingRequest);
        return handleCaseWhereInstituteSettingPresent(institute, settingRequest);
    }

    private String handleCaseWhereInstituteSettingPresent(Institute institute, Object settingRequest) {
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            GenericSettingRequest genericRequest = (GenericSettingRequest) settingRequest;
            
            // Parse the existing setting JSON string to Map
            InstituteSettingDto instituteSettingDto = objectMapper.readValue(
                    institute.getSetting(), InstituteSettingDto.class
            );

            Map<String, SettingDto> existingSettings = instituteSettingDto.getSetting();
            if (existingSettings == null) existingSettings = new HashMap<>();

            // Check if the setting already exists
            if (existingSettings.containsKey(getKey())) {
                // Just rebuild using rebuildInstituteSetting if already present
                return rebuildInstituteSetting(institute, settingRequest, getKey());
            }

            // Otherwise, create a new setting and add it
            SettingDto settingDto = new SettingDto();
            settingDto.setKey(getKey());
            settingDto.setName(genericRequest.getSettingName() != null ? genericRequest.getSettingName() : getKey().replace("_", " "));
            settingDto.setData(genericRequest.getSettingData());

            existingSettings.put(getKey(), settingDto);
            instituteSettingDto.setSetting(existingSettings);

            return objectMapper.writeValueAsString(instituteSettingDto);
        } catch (Exception e) {
            throw new VacademyException("Error updating setting: " + e.getMessage());
        }
    }

    private String handleCaseWhereNoSettingPresent(Institute institute, Object settingRequest) {
        try{
            ObjectMapper objectMapper = new ObjectMapper();
            GenericSettingRequest genericRequest = (GenericSettingRequest) settingRequest;

            InstituteSettingDto instituteSettingDto = new InstituteSettingDto();
            instituteSettingDto.setInstituteId(institute.getId());

            Map<String, SettingDto> settingMap = new HashMap<>();
            SettingDto settingDto = new SettingDto();
            settingDto.setKey(getKey());
            settingDto.setName(genericRequest.getSettingName() != null ? genericRequest.getSettingName() : getKey().replace("_", " "));
            settingDto.setData(genericRequest.getSettingData());

            settingMap.put(getKey(), settingDto);

            instituteSettingDto.setSetting(settingMap);

            return objectMapper.writeValueAsString(instituteSettingDto);
        } catch (Exception e) {
            throw new VacademyException("Error Creating Setting: " + e.getMessage());
        }
    }

    @Override
    public String rebuildInstituteSetting(Institute institute, Object settingRequest, String key) {
        setKey(key);
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            GenericSettingRequest genericRequest = (GenericSettingRequest) settingRequest;

            // Parse existing settings
            InstituteSettingDto instituteSettingDto = objectMapper.readValue(
                    institute.getSetting(), InstituteSettingDto.class
            );

            Map<String, SettingDto> settingMap = instituteSettingDto.getSetting();
            if (settingMap == null) throw new VacademyException("No Setting Found");

            if (!settingMap.containsKey(key)) {
               // set empty setting
               SettingDto settingDto = new SettingDto();
               settingDto.setKey(key);
               settingDto.setName(genericRequest.getSettingName() != null ? genericRequest.getSettingName() : key.replace("_", " "));
               settingDto.setData(genericRequest.getSettingData());
               settingMap.put(key, settingDto);
            }

            // Update existing setting data
            SettingDto settingDto = settingMap.get(key);
            if (genericRequest.getSettingName() != null) {
                settingDto.setName(genericRequest.getSettingName());
            }
            settingDto.setData(genericRequest.getSettingData());

            // Replace and return updated JSON
            settingMap.put(key, settingDto);
            instituteSettingDto.setSetting(settingMap);

            return objectMapper.writeValueAsString(instituteSettingDto);
        } catch (Exception e) {
            throw new VacademyException("Error rebuilding setting: " + e.getMessage());
        }
    }
} 