package vacademy.io.admin_core_service.features.institute.service.setting;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.course_settings.dto.DripConditionSettingsDTO;
import vacademy.io.admin_core_service.features.course_settings.service.DripConditionService;
import vacademy.io.admin_core_service.features.institute.dto.settings.GenericSettingRequest;
import vacademy.io.admin_core_service.features.institute.dto.settings.InstituteSettingDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.SettingDto;
import vacademy.io.admin_core_service.features.institute.enums.SettingKeyEnums;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

@Slf4j
@Service
public class GenericSettingStrategy extends IInstituteSettingStrategy {

    private DripConditionService dripConditionService;

    public void setDripConditionService(DripConditionService dripConditionService) {
        this.dripConditionService = dripConditionService;
    }

    @Override
    public String buildInstituteSetting(Institute institute, Object settingRequest) {
        String settingJsonString = institute.getSetting();
        if (Objects.isNull(settingJsonString))
            return handleCaseWhereNoSettingPresent(institute, settingRequest);
        return handleCaseWhereInstituteSettingPresent(institute, settingRequest);
    }

    private String handleCaseWhereInstituteSettingPresent(Institute institute, Object settingRequest) {
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            GenericSettingRequest genericRequest = (GenericSettingRequest) settingRequest;

            // Parse the existing setting JSON string to Map
            InstituteSettingDto instituteSettingDto = objectMapper.readValue(
                    institute.getSetting(), InstituteSettingDto.class);

            Map<String, SettingDto> existingSettings = instituteSettingDto.getSetting();
            if (existingSettings == null)
                existingSettings = new HashMap<>();

            // Check if the setting already exists
            if (existingSettings.containsKey(getKey())) {
                // Just rebuild using rebuildInstituteSetting if already present
                return rebuildInstituteSetting(institute, settingRequest, getKey());
            }

            // Otherwise, create a new setting and add it
            SettingDto settingDto = new SettingDto();
            settingDto.setKey(getKey());
            settingDto.setName(genericRequest.getSettingName() != null ? genericRequest.getSettingName()
                    : getKey().replace("_", " "));
            settingDto.setData(genericRequest.getSettingData());

            existingSettings.put(getKey(), settingDto);
            instituteSettingDto.setSetting(existingSettings);

            // Check if this is COURSE_SETTING and handle drip conditions
            if (SettingKeyEnums.COURSE_SETTING.name().equals(getKey())) {
                processDripConditions(genericRequest.getSettingData());
            }

            return objectMapper.writeValueAsString(instituteSettingDto);
        } catch (Exception e) {
            throw new VacademyException("Error updating setting: " + e.getMessage());
        }
    }

    private String handleCaseWhereNoSettingPresent(Institute institute, Object settingRequest) {
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            GenericSettingRequest genericRequest = (GenericSettingRequest) settingRequest;

            InstituteSettingDto instituteSettingDto = new InstituteSettingDto();
            instituteSettingDto.setInstituteId(institute.getId());

            Map<String, SettingDto> settingMap = new HashMap<>();
            SettingDto settingDto = new SettingDto();
            settingDto.setKey(getKey());
            settingDto.setName(genericRequest.getSettingName() != null ? genericRequest.getSettingName()
                    : getKey().replace("_", " "));
            settingDto.setData(genericRequest.getSettingData());

            settingMap.put(getKey(), settingDto);

            instituteSettingDto.setSetting(settingMap);

            // Check if this is COURSE_SETTING and handle drip conditions
            if (SettingKeyEnums.COURSE_SETTING.name().equals(getKey())) {
                processDripConditions(genericRequest.getSettingData());
            }

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
                    institute.getSetting(), InstituteSettingDto.class);

            Map<String, SettingDto> settingMap = instituteSettingDto.getSetting();
            if (settingMap == null)
                throw new VacademyException("No Setting Found");

            if (!settingMap.containsKey(key)) {
                // set empty setting
                SettingDto settingDto = new SettingDto();
                settingDto.setKey(key);
                settingDto.setName(genericRequest.getSettingName() != null ? genericRequest.getSettingName()
                        : key.replace("_", " "));
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

            // Check if this is COURSE_SETTING and handle drip conditions
            if (SettingKeyEnums.COURSE_SETTING.name().equals(key)) {
                processDripConditions(genericRequest.getSettingData());
            }

            return objectMapper.writeValueAsString(instituteSettingDto);
        } catch (Exception e) {
            throw new VacademyException("Error rebuilding setting: " + e.getMessage());
        }
    }

    /**
     * Process drip conditions from course setting data
     * Extracts dripCondition object and saves conditions based on level
     */
    @SuppressWarnings("unchecked")
    private void processDripConditions(Object settingData) {
        if (settingData == null) {
            log.warn("[DRIP_DEBUG] settingData is null, skipping drip condition processing");
            return;
        }

        if (dripConditionService == null) {
            log.error("[DRIP_DEBUG] dripConditionService is null! Check @Lazy injection.");
            return;
        }

        try {
            ObjectMapper objectMapper = new ObjectMapper();

            // Convert settingData to Map to check for dripConditions
            Map<String, Object> dataMap = objectMapper.convertValue(settingData, Map.class);
            log.info("[DRIP_DEBUG] Converted settingData to Map, keys: {}", dataMap.keySet());

            // Check if dripConditions exists in the setting data (note: plural form)
            if (dataMap.containsKey("dripConditions")) {
                Object dripConditionObj = dataMap.get("dripConditions");
                log.info("[DRIP_DEBUG] Found dripConditions object: {}", dripConditionObj);

                // Convert to DripConditionSettingsDTO
                DripConditionSettingsDTO dripSettings = objectMapper.convertValue(
                        dripConditionObj,
                        DripConditionSettingsDTO.class);

                log.info("[DRIP_DEBUG] Converted to DripConditionSettingsDTO - enabled: {}, conditions count: {}",
                        dripSettings != null ? dripSettings.getEnabled() : null,
                        dripSettings != null && dripSettings.getConditions() != null
                                ? dripSettings.getConditions().size()
                                : 0);

                if (dripSettings != null && dripSettings.getConditions() != null) {
                    log.info("Processing {} drip conditions from COURSE_SETTING",
                            dripSettings.getConditions().size());

                    // Save drip conditions to appropriate entities (package/chapter/slide)
                    dripConditionService.saveDripConditionSettings(dripSettings);

                    log.info("Successfully saved drip conditions");
                } else {
                    log.warn("[DRIP_DEBUG] dripSettings or conditions is null, skipping save");
                }
            } else {
                log.warn("[DRIP_DEBUG] 'dripCondition' key not found in settingData. Available keys: {}",
                        dataMap.keySet());
            }
        } catch (Exception e) {
            // Log error but don't fail the setting save operation
            log.error("[DRIP_DEBUG] Error processing drip conditions from COURSE_SETTING: {}", e.getMessage(), e);
        }
    }
}