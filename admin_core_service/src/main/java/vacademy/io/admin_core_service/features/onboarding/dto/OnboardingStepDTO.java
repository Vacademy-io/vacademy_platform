package vacademy.io.admin_core_service.features.onboarding.dto;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.onboarding.entity.OnboardingStep;

import java.util.Date;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class OnboardingStepDTO {
    private String id;
    private String flowId;
    private Integer stepOrder;
    private String stepName;
    private String stepType;
    /**
     * Type-specific config, e.g. FORM: {create_student, package_session_ids}.
     * package_session_ids is a course POOL, not one fixed course -- empty means the completing
     * admin picks any course at onboarding time, non-empty restricts them to that set.
     */
    private java.util.Map<String, Object> stepTypeConfig;
    private Boolean isOptional;
    private Boolean grantsStudentRole;
    private Boolean sendsLoginCredentials;
    private String status;
    private Date createdAt;
    private Date updatedAt;

    private List<OnboardingStepFieldConfigDTO> fields;
    private List<OnboardingRoleAccessDTO> roleAccess;

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    public static OnboardingStepDTO fromEntity(OnboardingStep step) {
        return OnboardingStepDTO.builder()
                .id(step.getId())
                .flowId(step.getFlowId())
                .stepOrder(step.getStepOrder())
                .stepName(step.getStepName())
                .stepType(step.getStepType())
                .stepTypeConfig(parseMap(step.getStepTypeConfig()))
                .isOptional(step.getIsOptional())
                .grantsStudentRole(step.getGrantsStudentRole())
                .sendsLoginCredentials(step.getSendsLoginCredentials())
                .roleAccess(parseRoleAccess(step.getRoleAccess()))
                .fields(parseFields(step.getFieldsConfig()))
                .status(step.getStatus())
                .createdAt(step.getCreatedAt())
                .updatedAt(step.getUpdatedAt())
                .build();
    }

    private static List<OnboardingStepFieldConfigDTO> parseFields(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return List.of(OBJECT_MAPPER.readValue(json, OnboardingStepFieldConfigDTO[].class));
        } catch (Exception e) {
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private static java.util.Map<String, Object> parseMap(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return OBJECT_MAPPER.readValue(json, java.util.Map.class);
        } catch (Exception e) {
            return null;
        }
    }

    private static List<OnboardingRoleAccessDTO> parseRoleAccess(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return List.of(OBJECT_MAPPER.readValue(json, OnboardingRoleAccessDTO[].class));
        } catch (Exception e) {
            return null;
        }
    }
}
