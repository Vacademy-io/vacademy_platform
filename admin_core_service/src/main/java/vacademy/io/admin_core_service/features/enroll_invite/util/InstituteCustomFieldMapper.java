package vacademy.io.admin_core_service.features.enroll_invite.util;

// Removed ObjectMapper import
import lombok.extern.slf4j.Slf4j;
// Removed @Service and @RequiredArgsConstructor
import vacademy.io.admin_core_service.features.common.util.JsonUtil; // Added import
import vacademy.io.admin_core_service.features.enroll_invite.dto.EnrollInviteSettingDTO;
import vacademy.io.admin_core_service.features.enroll_invite.enums.SubOrgRoles;
import vacademy.io.common.common.dto.CustomFieldValueDTO;
import vacademy.io.common.institute.entity.Institute;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Slf4j
public class InstituteCustomFieldMapper {

    // Removed ObjectMapper field

    public static Institute createInstitute(List<CustomFieldValueDTO> fieldValues, String settingsJson) {

        Map<String, String> fieldIdToLogicalNameMap = new HashMap<>();
        try {
            String cleanJson = settingsJson.replaceAll("\u00A0", " ");

            // Changed to use JsonUtil.fromJson
            EnrollInviteSettingDTO rootSettings = JsonUtil.fromJson(cleanJson, EnrollInviteSettingDTO.class);

            // Updated Optional chain to go through SUB_ORG_SETTING
            fieldIdToLogicalNameMap = Optional.ofNullable(rootSettings)
                .map(EnrollInviteSettingDTO::getSetting)
                .map(EnrollInviteSettingDTO.Settings::getSubOrgSetting) // <-- Added this level
                .map(EnrollInviteSettingDTO.SubOrgSetting::getCustomFieldMapping) // <-- Corrected typo
                .map(EnrollInviteSettingDTO.CustomFieldSetting::getData)
                .map(EnrollInviteSettingDTO.CustomFieldSettingData::getAllCustomFields)
                .orElse(Collections.emptyList()) // <-- Corrected type inference
                .stream()
                .filter(item -> item.getCustomFieldId() != null && item.getFieldName() != null)
                .collect(Collectors.toMap(
                    EnrollInviteSettingDTO.CustomFieldMapItem::getCustomFieldId,
                    EnrollInviteSettingDTO.CustomFieldMapItem::getFieldName,
                    (existing, replacement) -> existing
                ));

        } catch (Exception e) {
            log.error("Failed to parse custom field mappings from settings JSON", e);
            throw new RuntimeException("Invalid settings JSON", e);
        }

        Institute institute = new Institute();

        for (CustomFieldValueDTO fieldValue : fieldValues) {
            String logicalName = fieldIdToLogicalNameMap.get(fieldValue.getCustomFieldId());
            if (logicalName != null) {
                mapFieldToInstitute(institute, logicalName, fieldValue.getValue());
            }
        }

        return institute;
    }

    private static void mapFieldToInstitute(Institute institute, String logicalName, String value) {
        if (value == null) return;

        switch (logicalName.toLowerCase()) {
            case "name":
                institute.setInstituteName(value);
                break;
            case "email":
                institute.setEmail(value);
                break;
            case "phone":
                institute.setMobileNumber(value);
                break;
            case "address":
                institute.setAddress(value);
                break;
            case "pincode":
                institute.setPinCode(value);
                break;
            case "website":
                institute.setWebsiteUrl(value);
                break;
            case "country":
                institute.setCountry(value);
                break;
            case "state":
                institute.setState(value);
                break;
            case "city":
                institute.setCity(value);
                break;
            case "description":
                institute.setDescription(value);
                break;
            case "subdomain":
                institute.setSubdomain(value);
                break;
            default:
                // Safely ignore unmapped fields like 'admin_only_access'
                log.trace("Ignoring unmapped logical field for institute: {}", logicalName);
                break;
        }
    }

    public static String determineRolesAsString(List<CustomFieldValueDTO> fieldValues, String settingsJson) {

        EnrollInviteSettingDTO.Settings settings = getSettings(settingsJson);
        Map<String, String> fieldIdToLogicalNameMap = getCustomFieldMap(settings);

        // 1. Get the Role Configuration
        EnrollInviteSettingDTO.RoleConfiguration roleConfig = Optional.ofNullable(settings)
            .map(EnrollInviteSettingDTO.Settings::getSubOrgSetting)
            .map(EnrollInviteSettingDTO.SubOrgSetting::getRoleConfiguration)
            .orElse(null);

        if (roleConfig == null || roleConfig.getRoleFieldKey() == null) {
            log.warn("No 'ROLE_CONFIGURATION' or 'roleFieldKey' found. Defaulting to [ADMIN, LEARNER].");
            return getDefaultRolesAsString();
        }

        String logicalRoleFieldKey = roleConfig.getRoleFieldKey();

        // 2. Find the Custom Field ID for that logical key
        String adminOnlyFieldId = fieldIdToLogicalNameMap.entrySet().stream()
            .filter(entry -> logicalRoleFieldKey.equalsIgnoreCase(entry.getValue()))
            .map(Map.Entry::getKey)
            .findFirst()
            .orElse(null);

        if (adminOnlyFieldId == null) {
            log.warn("No custom field mapped to logical key '{}'. Defaulting to [ADMIN, LEARNER].", logicalRoleFieldKey);
            return getDefaultRolesAsString();
        }

        // 3. Find the value submitted for that Custom Field ID
        String submittedValue = fieldValues.stream()
            .filter(fv -> adminOnlyFieldId.equals(fv.getCustomFieldId()))
            .map(CustomFieldValueDTO::getValue)
            .findFirst()
            .orElse(null);

        // 4. Apply the "YES/NO" logic and return as String
        if ("yes".equalsIgnoreCase(submittedValue)) {
            return SubOrgRoles.ADMIN.name();
        } else {
            // "no", null, or any other value grants both roles
            return getDefaultRolesAsString();
        }
    }

    /**
     * Private helper to parse the JSON string once.
     */
    private static EnrollInviteSettingDTO.Settings getSettings(String settingsJson) {
        try {
            String cleanJson = settingsJson.replaceAll("\u00A0", " ");
            // Use JsonUtil
            EnrollInviteSettingDTO rootSettings = JsonUtil.fromJson(cleanJson, EnrollInviteSettingDTO.class);

            return Optional.ofNullable(rootSettings)
                .map(EnrollInviteSettingDTO::getSetting)
                .orElse(null);

        } catch (Exception e) {
            log.error("Failed to parse settings JSON", e);
            throw new RuntimeException("Invalid settings JSON", e);
        }
    }

    /**
     * Private helper to get the Custom Field ID -> Logical Name map.
     */
    private static Map<String, String> getCustomFieldMap(EnrollInviteSettingDTO.Settings settings) {
        return Optional.ofNullable(settings)
            .map(EnrollInviteSettingDTO.Settings::getSubOrgSetting)
            .map(EnrollInviteSettingDTO.SubOrgSetting::getCustomFieldMapping)
            .map(EnrollInviteSettingDTO.CustomFieldSetting::getData)
            .map(EnrollInviteSettingDTO.CustomFieldSettingData::getAllCustomFields)
            .orElse(Collections.emptyList())
            .stream()
            .filter(item -> item.getCustomFieldId() != null && item.getFieldName() != null)
            .collect(Collectors.toMap(
                EnrollInviteSettingDTO.CustomFieldMapItem::getCustomFieldId,
                EnrollInviteSettingDTO.CustomFieldMapItem::getFieldName,
                (existing, replacement) -> existing
            ));
    }


    private static String getDefaultRolesAsString() {
        return List.of(SubOrgRoles.ADMIN, SubOrgRoles.LEARNER)
            .stream()
            .map(SubOrgRoles::name)
            .collect(Collectors.joining(","));
    }
}
