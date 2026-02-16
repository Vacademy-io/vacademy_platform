package vacademy.io.admin_core_service.features.institute.service.setting;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import vacademy.io.admin_core_service.features.institute.dto.settings.InstituteSettingDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.SettingDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.role.RoleDisplayConfigDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.role.RoleDisplaySettingDto;
import vacademy.io.admin_core_service.features.institute.enums.SettingKeyEnums;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.exceptions.VacademyException;
import org.springframework.util.StringUtils;

import java.util.HashMap;
import java.util.Map;

public class RoleDisplaySettingStrategy extends IInstituteSettingStrategy {

    private final ObjectMapper objectMapper = new ObjectMapper();

    public RoleDisplaySettingStrategy() {
        this.setKey(SettingKeyEnums.ROLE_DISPLAY_SETTING.name());
    }

    @Override
    public String buildInstituteSetting(Institute institute, Object settingRequest) {
        try {
            RoleDisplaySettingDto requestDto = objectMapper.convertValue(settingRequest, RoleDisplaySettingDto.class);
            Map<String, RoleDisplayConfigDto> roleSettings = requestDto.getRoleSettings();

            // Apply defaults if empty or missing specific roles
            if (roleSettings == null) {
                roleSettings = new HashMap<>();
            }

            // Ensure defaults for system roles if not present (Optional, but good practice)
            // For now, we trust the incoming request or let frontend handle system role
            // defaults.
            // But strict requirement: Custom roles sidebar=false,
            // route=/study-library/courses

            applyCustomRoleDefaults(roleSettings);

            requestDto.setRoleSettings(roleSettings);

            // Wrap in SettingDto
            SettingDto settingDto = new SettingDto();
            settingDto.setKey(getKey());
            settingDto.setData(requestDto);

            // Wrap in InstituteSettingDto (existing settings + new one)
            InstituteSettingDto instituteSettingDto;
            if (StringUtils.hasText(institute.getSetting())) {
                instituteSettingDto = objectMapper.readValue(institute.getSetting(), InstituteSettingDto.class);
            } else {
                instituteSettingDto = new InstituteSettingDto();
                instituteSettingDto.setInstituteId(institute.getId());
                instituteSettingDto.setSetting(new HashMap<>());
            }

            instituteSettingDto.getSetting().put(getKey(), settingDto);

            return objectMapper.writeValueAsString(instituteSettingDto);

        } catch (JsonProcessingException e) {
            throw new VacademyException("Error processing role display settings: " + e.getMessage());
        }
    }

    @Override
    public String rebuildInstituteSetting(Institute institute, Object settingRequest, String key) {
        try {
            // Get existing settings
            String currentSettingsJson = institute.getSetting();
            InstituteSettingDto instituteSettingDto;

            if (StringUtils.hasText(currentSettingsJson)) {
                instituteSettingDto = objectMapper.readValue(currentSettingsJson, InstituteSettingDto.class);
            } else {
                instituteSettingDto = new InstituteSettingDto();
                instituteSettingDto.setInstituteId(institute.getId());
                instituteSettingDto.setSetting(new HashMap<>());
            }

            // Convert request to DTO
            RoleDisplaySettingDto newSettings = objectMapper.convertValue(settingRequest, RoleDisplaySettingDto.class);

            // Get existing role settings to merge
            RoleDisplaySettingDto existingRoleSettings = null;
            if (instituteSettingDto.getSetting().containsKey(key)) {
                SettingDto existingSettingDto = instituteSettingDto.getSetting().get(key);
                existingRoleSettings = objectMapper.convertValue(existingSettingDto.getData(),
                        RoleDisplaySettingDto.class);
            }

            // Merge logic: Update existing, add new
            Map<String, RoleDisplayConfigDto> mergedMap = new HashMap<>();

            if (existingRoleSettings != null && existingRoleSettings.getRoleSettings() != null) {
                mergedMap.putAll(existingRoleSettings.getRoleSettings());
            }

            if (newSettings.getRoleSettings() != null) {
                // Determine if we need to apply defaults for NEW keys
                for (Map.Entry<String, RoleDisplayConfigDto> entry : newSettings.getRoleSettings().entrySet()) {
                    String roleId = entry.getKey();
                    RoleDisplayConfigDto config = entry.getValue();

                    // If this is a new custom role (not in existing map), apply request defaults if
                    // null
                    // Actually, the request comes with values. We just need to ensure if user
                    // didn't send sidebar/route, we set defaults.
                    // But usually updates send full object.
                    // Let's ensure strict defaults for custom roles if fields are null.

                    if (isCustomRole(roleId)) {
                        if (config.getSidebarVisibility() == null)
                            config.setSidebarVisibility(false);
                        if (config.getPostLoginRoute() == null)
                            config.setPostLoginRoute("/study-library/courses");
                    }

                    mergedMap.put(roleId, config);
                }
            }

            newSettings.setRoleSettings(mergedMap);

            // Wrap and Save
            SettingDto settingDto = new SettingDto();
            settingDto.setKey(key);
            settingDto.setData(newSettings);

            instituteSettingDto.getSetting().put(key, settingDto);

            return objectMapper.writeValueAsString(instituteSettingDto);

        } catch (JsonProcessingException e) {
            throw new VacademyException("Error rebuilding role display settings: " + e.getMessage());
        }
    }

    private void applyCustomRoleDefaults(Map<String, RoleDisplayConfigDto> roleSettings) {
        roleSettings.forEach((roleId, config) -> {
            boolean isSystemRole = isSystemRole(roleId);
            if (!isSystemRole) {
                if (config.getSidebarVisibility() == null)
                    config.setSidebarVisibility(false);
                if (config.getPostLoginRoute() == null)
                    config.setPostLoginRoute("/study-library/courses");
            }
        });
    }

    // Heuristic or explicit check for system roles.
    // Since we don't have DB access here easily (Strategy pattern is lightweight),
    // we assume "Admin", "Teacher", "Learner", etc. are system keys if passed as
    // such,
    // or we rely on the fact that Custom Roles have UUIDs and System Roles might
    // have semantic names OR UUIDs.
    // However, the requirement says "similar like adminDisplay, teacherDisplay".
    // Let's assume non-standard IDs are custom.
    private boolean isSystemRole(String roleKey) {
        return "Admin".equalsIgnoreCase(roleKey) ||
                "Teacher".equalsIgnoreCase(roleKey) ||
                "Learner".equalsIgnoreCase(roleKey) ||
                "Student".equalsIgnoreCase(roleKey);
    }

    // Better check: Custom roles are usually UUIDs. System roles could be names or
    // specific UUIDs.
    // Logic: If sidebarVisibility is NOT explicitly set to true, default to false
    // for everyone except known system roles?
    // User said: "in the default one the sidebar will be not visible...
    // postloginroute will be /study-library/courses" for custom roles.
    private boolean isCustomRole(String roleKey) {
        return !isSystemRole(roleKey);
    }
}
