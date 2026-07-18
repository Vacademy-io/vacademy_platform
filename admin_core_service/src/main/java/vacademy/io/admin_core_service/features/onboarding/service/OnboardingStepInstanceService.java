package vacademy.io.admin_core_service.features.onboarding.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.common.entity.CustomFieldValues;
import vacademy.io.admin_core_service.features.common.entity.CustomFields;
import vacademy.io.admin_core_service.features.common.entity.InstituteCustomField;
import vacademy.io.admin_core_service.features.common.enums.CustomFieldValueSourceTypeEnum;
import vacademy.io.admin_core_service.features.common.repository.CustomFieldRepository;
import vacademy.io.admin_core_service.features.common.repository.CustomFieldValuesRepository;
import vacademy.io.admin_core_service.features.common.repository.InstituteCustomFieldRepository;
import vacademy.io.admin_core_service.features.onboarding.dto.OnboardingStepFieldConfigDTO;
import vacademy.io.admin_core_service.features.onboarding.dto.OnboardingStepInstanceDTO;
import vacademy.io.admin_core_service.features.onboarding.dto.OnboardingSubmittedFieldDTO;
import vacademy.io.admin_core_service.features.onboarding.entity.OnboardingInstance;
import vacademy.io.admin_core_service.features.onboarding.entity.OnboardingStep;
import vacademy.io.admin_core_service.features.onboarding.entity.OnboardingStepInstance;
import vacademy.io.admin_core_service.features.onboarding.enums.OnboardingRoleKey;
import vacademy.io.admin_core_service.features.onboarding.enums.OnboardingStepInstanceStatus;
import vacademy.io.admin_core_service.features.onboarding.repository.OnboardingInstanceRepository;
import vacademy.io.admin_core_service.features.onboarding.repository.OnboardingStepInstanceRepository;
import vacademy.io.admin_core_service.features.onboarding.repository.OnboardingStepRepository;
import vacademy.io.admin_core_service.features.onboarding.steptype.OnboardingStepTypeHandler;
import vacademy.io.admin_core_service.features.onboarding.steptype.OnboardingStepTypeHandlerRegistry;
import vacademy.io.admin_core_service.features.workflow.enums.WorkflowTriggerEvent;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowTriggerService;
import vacademy.io.common.exceptions.ForbiddenException;
import vacademy.io.common.exceptions.InvalidRequestException;
import vacademy.io.common.exceptions.ResourceNotFoundException;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Advances a single onboarding_step_instance through PENDING -> IN_PROGRESS -> COMPLETED/SKIPPED,
 * dispatching to the step-type handler and firing per-step workflow triggers along the way.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OnboardingStepInstanceService {

    private final OnboardingStepInstanceRepository stepInstanceRepository;
    private final OnboardingInstanceRepository onboardingInstanceRepository;
    private final OnboardingStepRepository onboardingStepRepository;
    private final OnboardingStepTypeHandlerRegistry stepTypeHandlerRegistry;
    private final OnboardingTriggerContextBuilder triggerContextBuilder;
    private final AuthService authService;
    private final InstituteCustomFieldRepository instituteCustomFieldRepository;
    private final CustomFieldRepository customFieldRepository;
    private final CustomFieldValuesRepository customFieldValuesRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * @Lazy breaks the same init-time bean cycle CallAiNodeHandler/SetLeadStatusNodeHandler guard
     * against: this service -> WorkflowTriggerService -> WorkflowEngineService -> NodeHandlerRegistry
     * -> StartOnboardingFlowNodeHandler -> OnboardingInstanceService -> this service.
     */
    @Autowired
    @Lazy
    private WorkflowTriggerService workflowTriggerService;

    /** Creates (or reuses) the PENDING step-instance row for `step` and moves it to IN_PROGRESS. */
    @Transactional
    public OnboardingStepInstance enterStep(OnboardingInstance instance, OnboardingStep step) {
        OnboardingStepInstance stepInstance = stepInstanceRepository
                .findByOnboardingInstanceIdAndStepId(instance.getId(), step.getId())
                .orElseGet(() -> OnboardingStepInstance.builder()
                        .onboardingInstanceId(instance.getId())
                        .stepId(step.getId())
                        .status(OnboardingStepInstanceStatus.PENDING.name())
                        .build());

        stepInstance.setStatus(OnboardingStepInstanceStatus.IN_PROGRESS.name());
        stepInstance.setEnteredAt(new Date());
        OnboardingStepInstance savedStepInstance = stepInstanceRepository.save(stepInstance);

        instance.setCurrentStepId(step.getId());
        onboardingInstanceRepository.save(instance);

        OnboardingStepTypeHandler handler = stepTypeHandlerRegistry.getHandler(step.getStepType());
        if (handler != null) {
            try {
                handler.onEnter(savedStepInstance, step);
            } catch (Exception e) {
                log.warn("onEnter failed for step {} (stepInstance {}): {}", step.getId(), savedStepInstance.getId(), e.getMessage());
            }
        }

        fireTrigger(instance, step, WorkflowTriggerEvent.ONBOARDING_STEP_ENTERED);
        return savedStepInstance;
    }

    @Transactional
    public OnboardingStepInstance completeStep(String stepInstanceId, Map<String, Object> payload,
                                                String actorRoleKey, String actorUserId) {
        OnboardingStepInstance stepInstance = getStepInstance(stepInstanceId);
        OnboardingStep step = onboardingStepRepository.findById(stepInstance.getStepId())
                .orElseThrow(() -> new ResourceNotFoundException("Onboarding step not found: " + stepInstance.getStepId()));
        OnboardingInstance instance = onboardingInstanceRepository.findById(stepInstance.getOnboardingInstanceId())
                .orElseThrow(() -> new ResourceNotFoundException("Onboarding instance not found: " + stepInstance.getOnboardingInstanceId()));

        // A step that assigns a course is an administrative action, not something a learner
        // self-serves -- otherwise a caller with an empty course pool (open choice) could pick
        // ANY course and enroll themselves. Enforced here (not just in the learner-app UI) since
        // the learner endpoint always resolves the caller's real role before calling this.
        if (isCreateStudentConfigured(step) && !OnboardingRoleKey.ADMIN.name().equals(actorRoleKey)) {
            throw new ForbiddenException("This step assigns a course and must be completed by an admin.");
        }

        OnboardingStepTypeHandler handler = stepTypeHandlerRegistry.getHandler(step.getStepType());
        OnboardingStepInstanceStatus resultStatus = handler != null
                ? handler.onSubmit(stepInstance, step, payload, actorRoleKey, actorUserId)
                : OnboardingStepInstanceStatus.COMPLETED;

        stepInstance.setStatus(resultStatus.name());
        if (resultStatus == OnboardingStepInstanceStatus.COMPLETED) {
            stepInstance.setCompletedAt(new Date());
            stepInstance.setCompletedByUserId(actorUserId);
            stepInstance.setCompletedByRole(actorRoleKey);
        }
        OnboardingStepInstance savedStepInstance = stepInstanceRepository.save(stepInstance);

        if (resultStatus != OnboardingStepInstanceStatus.COMPLETED) {
            return savedStepInstance;
        }

        applyCompletionSideEffects(instance, step);
        fireTrigger(instance, step, WorkflowTriggerEvent.ONBOARDING_STEP_COMPLETED);
        advanceToNextStep(instance, step);
        return savedStepInstance;
    }

    @Transactional
    public OnboardingStepInstance skipStep(String stepInstanceId, String reason, String actorUserId) {
        OnboardingStepInstance stepInstance = getStepInstance(stepInstanceId);
        OnboardingStep step = onboardingStepRepository.findById(stepInstance.getStepId())
                .orElseThrow(() -> new ResourceNotFoundException("Onboarding step not found: " + stepInstance.getStepId()));
        if (!Boolean.TRUE.equals(step.getIsOptional())) {
            // InvalidRequestException -> 400 via GlobalExceptionHandler; see FormStepTypeHandler
            // for the same fix on the mandatory-field-validation path.
            throw new InvalidRequestException("Step is not optional and cannot be skipped: " + step.getId());
        }
        OnboardingInstance instance = onboardingInstanceRepository.findById(stepInstance.getOnboardingInstanceId())
                .orElseThrow(() -> new ResourceNotFoundException("Onboarding instance not found: " + stepInstance.getOnboardingInstanceId()));

        stepInstance.setStatus(OnboardingStepInstanceStatus.SKIPPED.name());
        stepInstance.setSkipReason(reason);
        stepInstance.setCompletedAt(new Date());
        stepInstance.setCompletedByUserId(actorUserId);
        stepInstance.setCompletedByRole(OnboardingRoleKey.ADMIN.name());
        OnboardingStepInstance savedStepInstance = stepInstanceRepository.save(stepInstance);

        fireTrigger(instance, step, WorkflowTriggerEvent.ONBOARDING_STEP_SKIPPED);
        advanceToNextStep(instance, step);
        return savedStepInstance;
    }

    private void applyCompletionSideEffects(OnboardingInstance instance, OnboardingStep step) {
        if (Boolean.TRUE.equals(step.getGrantsStudentRole())) {
            authService.addRolesToUserInternal(instance.getSubjectUserId(), List.of("STUDENT"), instance.getInstituteId());
        }
        if (Boolean.TRUE.equals(step.getSendsLoginCredentials())) {
            try {
                authService.sendCredToUsers(List.of(instance.getSubjectUserId()));
            } catch (Exception e) {
                log.warn("Failed to send login credentials to {} for onboarding step {}: {}",
                        instance.getSubjectUserId(), step.getId(), e.getMessage());
            }
        }
    }

    private void advanceToNextStep(OnboardingInstance instance, OnboardingStep completedOrSkippedStep) {
        Optional<OnboardingStep> next = onboardingStepRepository
                .findFirstByFlowIdAndStatusAndStepOrderGreaterThanOrderByStepOrderAsc(
                        instance.getFlowId(), "ACTIVE", completedOrSkippedStep.getStepOrder());
        if (next.isPresent()) {
            enterStep(instance, next.get());
        } else {
            instance.setStatus("COMPLETED");
            instance.setCompletedAt(new Date());
            instance.setCurrentStepId(null);
            onboardingInstanceRepository.save(instance);
            try {
                workflowTriggerService.handleTriggerEvents(
                        WorkflowTriggerEvent.ONBOARDING_FLOW_COMPLETED.name(),
                        instance.getFlowId(),
                        instance.getInstituteId(),
                        triggerContextBuilder.forFlowChange(instance, "COMPLETED"));
            } catch (Exception e) {
                log.warn("Failed to fire ONBOARDING_FLOW_COMPLETED for instance {}: {}", instance.getId(), e.getMessage());
            }
        }
    }

    private void fireTrigger(OnboardingInstance instance, OnboardingStep step, WorkflowTriggerEvent event) {
        try {
            workflowTriggerService.handleTriggerEvents(
                    event.name(),
                    step.getId(),
                    instance.getInstituteId(),
                    triggerContextBuilder.forStepChange(instance, step, event.name()));
        } catch (Exception e) {
            log.warn("Failed to fire {} for step {} (instance {}): {}",
                    event.name(), step.getId(), instance.getId(), e.getMessage());
        }
    }

    public OnboardingStepInstance getStepInstance(String stepInstanceId) {
        return stepInstanceRepository.findById(stepInstanceId)
                .orElseThrow(() -> new ResourceNotFoundException("Onboarding step instance not found: " + stepInstanceId));
    }

    public List<OnboardingStepInstance> listStepInstances(String onboardingInstanceId) {
        return stepInstanceRepository.findByOnboardingInstanceId(onboardingInstanceId);
    }

    /** Enriches a single step instance with its step's name/type -- prefer this over the bare DTO mapper. */
    public OnboardingStepInstanceDTO toDto(OnboardingStepInstance stepInstance) {
        OnboardingStep step = onboardingStepRepository.findById(stepInstance.getStepId()).orElse(null);
        return OnboardingStepInstanceDTO.fromEntity(stepInstance, step);
    }

    /** Batch variant of {@link #toDto} -- one step lookup query regardless of list size. */
    public List<OnboardingStepInstanceDTO> toDtos(List<OnboardingStepInstance> stepInstances) {
        if (stepInstances.isEmpty()) return List.of();
        Map<String, OnboardingStep> stepsById = onboardingStepRepository
                .findAllById(stepInstances.stream().map(OnboardingStepInstance::getStepId).distinct().toList())
                .stream()
                .collect(Collectors.toMap(OnboardingStep::getId, s -> s));
        return stepInstances.stream()
                .map(si -> OnboardingStepInstanceDTO.fromEntity(si, stepsById.get(si.getStepId())))
                .toList();
    }

    /**
     * The actual values submitted for a FORM step instance -- previously unavailable via any
     * onboarding endpoint, so the side-view's "View form" dialog could only show field NAMES.
     * Resolves each of the step's configured fields to its submitted value (null if that
     * particular field was never filled in, e.g. an optional field left blank).
     */
    public List<OnboardingSubmittedFieldDTO> getSubmittedFieldValues(String stepInstanceId) {
        OnboardingStepInstance stepInstance = getStepInstance(stepInstanceId);
        OnboardingStep step = onboardingStepRepository.findById(stepInstance.getStepId())
                .orElseThrow(() -> new ResourceNotFoundException("Onboarding step not found: " + stepInstance.getStepId()));
        List<OnboardingStepFieldConfigDTO> fieldConfigs = parseFieldConfigs(step.getFieldsConfig());
        if (fieldConfigs.isEmpty()) return List.of();

        Map<String, String> valueByCustomFieldId = customFieldValuesRepository
                .findBySourceTypeAndSourceId(CustomFieldValueSourceTypeEnum.ONBOARDING_STEP_INSTANCE.name(), stepInstanceId)
                .stream()
                .collect(Collectors.toMap(CustomFieldValues::getCustomFieldId, CustomFieldValues::getValue, (a, b) -> a));

        List<OnboardingSubmittedFieldDTO> out = new ArrayList<>();
        for (OnboardingStepFieldConfigDTO fieldConfig : fieldConfigs) {
            Optional<InstituteCustomField> instituteCustomField =
                    instituteCustomFieldRepository.findById(fieldConfig.getInstituteCustomFieldId());
            if (instituteCustomField.isEmpty()) continue;
            String customFieldId = instituteCustomField.get().getCustomFieldId();
            String fieldName = customFieldRepository.findById(customFieldId)
                    .map(CustomFields::getFieldName).orElse(null);
            out.add(OnboardingSubmittedFieldDTO.builder()
                    .instituteCustomFieldId(fieldConfig.getInstituteCustomFieldId())
                    .fieldName(fieldName)
                    .value(valueByCustomFieldId.get(customFieldId))
                    .build());
        }
        return out;
    }

    private boolean isCreateStudentConfigured(OnboardingStep step) {
        String json = step.getStepTypeConfig();
        if (json == null || json.isBlank()) return false;
        try {
            JsonNode v = objectMapper.readTree(json).get("create_student");
            return v != null && ("true".equalsIgnoreCase(v.asText()) || v.asBoolean(false));
        } catch (Exception e) {
            return false;
        }
    }

    private List<OnboardingStepFieldConfigDTO> parseFieldConfigs(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return List.of(objectMapper.readValue(json, OnboardingStepFieldConfigDTO[].class));
        } catch (Exception e) {
            return List.of();
        }
    }
}
