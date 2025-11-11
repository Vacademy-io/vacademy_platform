package vacademy.io.admin_core_service.features.enroll_invite.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import java.util.List;

/**
 * Main DTO to parse the complex settings JSON from the EnrollInvite entity.
 * This single class contains all nested DTOs as static inner classes
 * and can hold multiple, independent setting blocks.
 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class EnrollInviteSettingDTO {

    @JsonProperty("setting")
    private Settings setting;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Settings {

        /**
         * A block for all settings related to Sub-Organization creation.
         * This is scalable for future sub-org-related settings.
         */
        @JsonProperty("SUB_ORG_SETTING")
        private SubOrgSetting subOrgSetting;


        // You can add other top-level setting blocks here
    }

    // --- Sub-Organization Setting Block ---
    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class SubOrgSetting {

        /**
         * This block contains the mapping of custom field IDs
         * to their logical purpose (e.g., "name", "email").
         */
        @JsonProperty("CUSTOM_FIELD_MAPPING")
        private CustomFieldSetting customFieldMapping;

        /**
         * This block defines which logical field is used
         * to determine the roles of the new user.
         */
        @JsonProperty("ROLE_CONFIGURATION")
        private RoleConfiguration roleConfiguration;

    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class RoleConfiguration {
        @JsonProperty("roleFieldKey")
        private String roleFieldKey;
    }

    // --- Sub-Org Custom Field Mapping Classes ---
    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class CustomFieldSetting {
        @JsonProperty("data")
        private CustomFieldSettingData data;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class CustomFieldSettingData {
        @JsonProperty("allCustomFields")
        private List<CustomFieldMapItem> allCustomFields;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class CustomFieldMapItem {
        @JsonProperty("customFieldId")
        private String customFieldId;

        @JsonProperty("fieldName")
        private String fieldName;
    }

}
