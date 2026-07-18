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
import vacademy.io.admin_core_service.features.onboarding.service.OnboardingRoleAccessResolutionService;
import vacademy.io.admin_core_service.features.onboarding.service.OnboardingStudentCreationService;
import vacademy.io.common.exceptions.InvalidRequestException;

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
    private final OnboardingRoleAccessResolutionService roleAccessResolutionService;
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

            // Never trust the client's edit intent: re-check per-field permission for the
            // actual caller role server-side, exactly like every other field below relies on
            // fieldConfig.isMandatory rather than trusting what the client claims. A field the
            // caller can't edit is treated as not submitted, so a tampered/naive payload can't
            // write to it -- it just falls through to the mandatory-field check like any other
            // absent value.
            boolean canEdit = roleAccessResolutionService
                    .resolveFieldAccess(step.getId(), fieldConfig.getInstituteCustomFieldId(), actorRoleKey)
                    .canEdit;

            String customFieldId = instituteCustomField.get().getCustomFieldId();
            Object rawValue = (!canEdit || payload == null) ? null : payload.get(fieldConfig.getInstituteCustomFieldId());
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
            // InvalidRequestException -> 400 via the shared GlobalExceptionHandler. A bare
            // RuntimeException/IllegalArgumentException falls through that handler's generic
            // RuntimeException catch-all, which maps to 511 -- wrong for a client validation error.
            throw new InvalidRequestException(
                    "Missing mandatory field(s): " + String.join(", ", missingMandatory));
        }

        customFieldValueService.upsertCustomFieldValues(valuesToSave);

        if (isCreateStudentConfigured(step)) {
            // Parent-vs-student resolution (is_parent + student_* fields) already ran centrally
            // in OnboardingStepInstanceService.completeStep, before this handler was invoked --
            // stepInstance's onboarding_instance already carries the correct subject by now.
            String selectedPackageSessionId = resolveSelectedPackageSessionId(step, payload);
            onboardingStudentCreationService.createStudentIfAbsent(stepInstance, selectedPackageSessionId);
        }

        return OnboardingStepInstanceStatus.COMPLETED;
    }

    /**
     * The step is built with a course POOL ({@code package_session_ids}), not one fixed course --
     * so a single flow works across every course a lead might land in, and doesn't need rebuilding
     * every time a new course is created. Empty/absent pool -- the completing admin picks ANY
     * course (open choice); non-empty pool -- they must pick one FROM that pool (validated
     * server-side, never trusted from the client). Either way the actual choice travels in the
     * same submit payload as the field values, under the reserved key "package_session_id" (safe
     * to co-mingle with institute_custom_field_id keys, which are UUIDs).
     */
    private String resolveSelectedPackageSessionId(OnboardingStep step, Map<String, Object> payload) {
        Object raw = payload == null ? null : payload.get("package_session_id");
        String selected = raw == null ? null : String.valueOf(raw);
        if (!StringUtils.hasText(selected)) {
            throw new InvalidRequestException("Pick a course to enroll the student into");
        }
        List<String> pool = readConfigList(step.getStepTypeConfig(), "package_session_ids");
        if (!pool.isEmpty() && !pool.contains(selected)) {
            throw new InvalidRequestException("Selected course is not one of the allowed courses for this step");
        }
        return selected;
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

    private List<String> readConfigList(String json, String key) {
        if (json == null || json.isBlank()) return List.of();
        try {
            JsonNode v = objectMapper.readTree(json).get(key);
            if (v == null || v.isNull() || !v.isArray()) return List.of();
            List<String> out = new ArrayList<>();
            v.forEach(n -> {
                if (n != null && !n.isNull() && StringUtils.hasText(n.asText())) out.add(n.asText());
            });
            return out;
        } catch (Exception e) {
            return List.of();
        }
    }
}
