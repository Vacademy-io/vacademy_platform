package vacademy.io.admin_core_service.features.onboarding.steptype;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.common.dto.request.CustomFieldValueDto;
import vacademy.io.admin_core_service.features.common.entity.InstituteCustomField;
import vacademy.io.admin_core_service.features.common.enums.CustomFieldValueSourceTypeEnum;
import vacademy.io.admin_core_service.features.common.enums.CustomFieldTypeEnum;
import vacademy.io.admin_core_service.features.common.repository.InstituteCustomFieldRepository;
import vacademy.io.admin_core_service.features.common.service.CustomFieldValueService;
import vacademy.io.admin_core_service.features.onboarding.dto.OnboardingStepFieldConfigDTO;
import vacademy.io.admin_core_service.features.onboarding.entity.OnboardingStep;
import vacademy.io.admin_core_service.features.onboarding.entity.OnboardingStepInstance;
import vacademy.io.admin_core_service.features.onboarding.enums.OnboardingStepInstanceStatus;
import vacademy.io.admin_core_service.features.onboarding.enums.OnboardingStepTypeEnum;
import vacademy.io.admin_core_service.features.onboarding.service.OnboardingStudentCreationService;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * FORM step type -- v1's only step type. Renders/validates the step's configured
 * {@link OnboardingStepFieldConfigDTO} entries (parsed from {@link OnboardingStep#getFieldsConfig()},
 * each backed by a shared institute_custom_fields row) and stores submitted values via the
 * existing custom-fields infrastructure, exactly the way AUDIENCE_FORM responses are stored
 * today, just under a new source type.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FormStepTypeHandler implements OnboardingStepTypeHandler {

    private final InstituteCustomFieldRepository instituteCustomFieldRepository;
    private final CustomFieldValueService customFieldValueService;
    private final OnboardingStudentCreationService onboardingStudentCreationService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public boolean supports(String stepType) {
        return OnboardingStepTypeEnum.FORM.name().equalsIgnoreCase(stepType);
    }

    @Override
    @SuppressWarnings("unchecked")
    public OnboardingStepInstanceStatus onSubmit(OnboardingStepInstance stepInstance,
                                                  OnboardingStep step,
                                                  Map<String, Object> payload,
                                                  String actorRoleKey,
                                                  String actorUserId) {
        List<OnboardingStepFieldConfigDTO> fieldConfigs = parseFieldConfigs(step.getFieldsConfig());

        List<CustomFieldValueDto> valuesToSave = new ArrayList<>();
        List<String> missingMandatory = new ArrayList<>();

        for (OnboardingStepFieldConfigDTO fieldConfig : fieldConfigs) {
            Optional<InstituteCustomField> instituteCustomField =
                    instituteCustomFieldRepository.findById(fieldConfig.getInstituteCustomFieldId());
            if (instituteCustomField.isEmpty()) {
                log.warn("step {} fields_config references missing institute_custom_field {}",
                        step.getId(), fieldConfig.getInstituteCustomFieldId());
                continue;
            }

            String customFieldId = instituteCustomField.get().getCustomFieldId();
            Object rawValue = payload == null ? null : payload.get(fieldConfig.getInstituteCustomFieldId());
            String value = rawValue == null ? null : String.valueOf(rawValue);

            if (Boolean.TRUE.equals(fieldConfig.getIsMandatory()) && !StringUtils.hasText(value)) {
                missingMandatory.add(fieldConfig.getInstituteCustomFieldId());
                continue;
            }

            if (StringUtils.hasText(value)) {
                CustomFieldValueDto dto = new CustomFieldValueDto();
                dto.setCustomFieldId(customFieldId);
                dto.setSourceType(CustomFieldValueSourceTypeEnum.ONBOARDING_STEP_INSTANCE.name());
                dto.setSourceId(stepInstance.getId());
                dto.setType(CustomFieldTypeEnum.ONBOARDING_STEP.name());
                dto.setTypeId(step.getId());
                dto.setValue(value);
                valuesToSave.add(dto);
            }
        }

        if (!missingMandatory.isEmpty()) {
            throw new IllegalArgumentException(
                    "Missing mandatory field(s): " + String.join(", ", missingMandatory));
        }

        customFieldValueService.upsertCustomFieldValues(valuesToSave);

        if (isCreateStudentConfigured(step)) {
            // Keys are snake_case: the FORM step builder UI writes step_type_config as a raw
            // JSON object with these literal keys (create_student / package_session_id).
            String targetPackageSessionId = readConfig(step.getStepTypeConfig(), "package_session_id");
            onboardingStudentCreationService.createStudentIfAbsent(stepInstance, targetPackageSessionId);
        }

        return OnboardingStepInstanceStatus.COMPLETED;
    }

    private boolean isCreateStudentConfigured(OnboardingStep step) {
        return "true".equalsIgnoreCase(readConfig(step.getStepTypeConfig(), "create_student"));
    }

    private List<OnboardingStepFieldConfigDTO> parseFieldConfigs(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return List.of(objectMapper.readValue(json, OnboardingStepFieldConfigDTO[].class));
        } catch (Exception e) {
            return List.of();
        }
    }

    private String readConfig(String json, String key) {
        if (json == null || json.isBlank()) return null;
        try {
            JsonNode v = objectMapper.readTree(json).get(key);
            return v == null || v.isNull() ? null : v.asText();
        } catch (Exception e) {
            return null;
        }
    }
}
