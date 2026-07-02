package vacademy.io.admin_core_service.features.suborg.registration.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.common.dto.InstituteCustomFieldDTO;
import vacademy.io.common.common.dto.CustomFieldValueDTO;

import java.sql.Timestamp;
import java.util.List;

/** Request/response DTOs for the public registration flow + admin listing. */
public final class SubOrgRegistrationFlowDTOs {

    private SubOrgRegistrationFlowDTOs() {
    }

    /** Public payload rendered by the open wizard page. */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class PublicTemplateDTO {
        private String templateName;
        private String instituteId;
        private List<String> steps;
        private String tncFileId;
        private List<InstituteCustomFieldDTO> customFields;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class StartRegistrationRequestDTO {
        private String instituteId;
        private String code;
        private String orgName;
        private String orgLogoFileId;
        private String adminName;
        private String adminEmail;
        private String adminPhone;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class StartRegistrationResponseDTO {
        private String registrationId;
        private String status;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class VerifyOtpRequestDTO {
        private String registrationId;
        private String otp;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class ResendOtpRequestDTO {
        private String registrationId;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class CompleteRegistrationRequestDTO {
        private String registrationId;
        private Boolean tncAccepted;
        private List<CustomFieldValueDTO> customFieldValues;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class CompleteRegistrationResponseDTO {
        private String registrationId;
        private String status;
        private String subOrgId;
        private String adminEmail;
    }

    /** Admin list row for a template. */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class TemplateListItemDTO {
        private String id;
        private String name;
        private String inviteCode;
        private String status;
        private Timestamp createdAt;
        private long completedCount;
        private long totalAttempts;
        private Integer maxRegistrations;
        private List<String> steps;
    }

    /** Admin read-only registration row. */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class RegistrationListItemDTO {
        private String id;
        private String status;
        private String orgName;
        private String adminName;
        private String adminEmail;
        private String adminPhone;
        private String spawnedSubOrgId;
        private Timestamp createdAt;
    }
}
