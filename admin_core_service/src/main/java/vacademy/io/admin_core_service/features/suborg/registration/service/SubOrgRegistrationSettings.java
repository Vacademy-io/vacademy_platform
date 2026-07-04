package vacademy.io.admin_core_service.features.suborg.registration.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.suborg.registration.dto.SubOrgRegistrationSettingDTO;

/** Parse/serialize helpers for the template invite's SUB_ORG_REGISTRATION_SETTING block. */
final class SubOrgRegistrationSettings {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private SubOrgRegistrationSettings() {
    }

    static SubOrgRegistrationSettingDTO.RegistrationSetting parse(String settingJson) {
        if (!StringUtils.hasText(settingJson)) return null;
        try {
            SubOrgRegistrationSettingDTO dto =
                    MAPPER.readValue(settingJson, SubOrgRegistrationSettingDTO.class);
            return dto != null ? dto.getRegistrationSetting() : null;
        } catch (Exception e) {
            return null;
        }
    }

    static String serialize(SubOrgRegistrationSettingDTO.RegistrationSetting setting) {
        try {
            SubOrgRegistrationSettingDTO dto = new SubOrgRegistrationSettingDTO();
            dto.setRegistrationSetting(setting);
            return MAPPER.writeValueAsString(dto);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to serialize registration settings", e);
        }
    }
}
