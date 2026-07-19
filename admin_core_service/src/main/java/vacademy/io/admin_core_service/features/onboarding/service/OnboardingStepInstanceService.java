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
import vacademy.io.admin_core_service.features.onboarding.dto.OnboardingResolvedFieldDTO;
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
import java.util.Comparator;
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
    private final OnboardingStudentCreationService onboardingStudentCreationService;
    private final OnboardingRoleAccessResolutionService roleAccessResolutionService;
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

        // Idempotent no-op on a step already finalized -- a double-click, client retry, or
        // replayed request must not re-run side effects (credentials email isn't itself
        // idempotent, and re-advancing would regress an already-COMPLETED next step back to
        // IN_PROGRESS and re-fire its ONBOARDING_STEP_ENTERED trigger).
        if (OnboardingStepInstanceStatus.COMPLETED.name().equals(stepInstance.getStatus())
                || OnboardingStepInstanceStatus.SKIPPED.name().equals(stepInstance.getStatus())) {
            return stepInstance;
        }

        OnboardingInstance instance = onboardingInstanceRepository.findById(stepInstance.getOnboardingInstanceId())
                .orElseThrow(() -> new ResourceNotFoundException("Onboarding instance not found: " + stepInstance.getOnboardingInstanceId()));

        boolean requestsParentResolution = payload != null
                && "true".equalsIgnoreCase(String.valueOf(payload.get("is_parent")));

        // A step that assigns a course, that resolves "filled by a parent" into a brand-new user
        // account, or whose step-level role_access denies this role edit permission, is not
        // something a non-admin caller may complete -- otherwise a caller could either enroll
        // themselves in any course (empty pool), create arbitrary new accounts under themselves-
        // as-parent with zero oversight, or complete a step an admin explicitly locked to
        // themselves via role_access despite it having no create_student config. Enforced here
        // (not just in the learner-app UI, which only renders the form when learner_can_act
        // permits it) since the learner endpoint always resolves the caller's real role before
        // calling this.
        if (!OnboardingRoleKey.ADMIN.name().equals(actorRoleKey)
                && (requestsParentResolution || !isActionableForRole(step, actorRoleKey))) {
            throw new ForbiddenException("This action must be completed by an admin.");
        }

        // Leads can be filled out by either the student or a parent on their behalf. Resolve
        // that BEFORE any identity-touching side effect -- role grant, credentials, or course
        // enrollment can each live on their own, independent step, so this can't be scoped to
        // just the create_student step. Once resolved, instance.subjectUserId is reassigned to
        // the real student for the rest of this completion AND every later step (same managed
        // entity within this transaction, visible to applyCompletionSideEffects below and to
        // FormStepTypeHandler's own instance lookup).
        boolean touchesIdentity = Boolean.TRUE.equals(step.getGrantsStudentRole())
                || Boolean.TRUE.equals(step.getSendsLoginCredentials())
                || isCreateStudentConfigured(step);
        if (touchesIdentity && requestsParentResolution) {
            onboardingStudentCreationService.resolveSubjectUserId(instance, true,
                    readPayloadString(payload, "student_full_name"),
                    readPayloadString(payload, "student_email"),
                    readPayloadString(payload, "student_mobile_number"));
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

        // Idempotent no-op on a step already finalized -- see completeStep for why (double-click /
        // retry must not re-fire triggers or re-advance an already-COMPLETED next step).
        if (OnboardingStepInstanceStatus.COMPLETED.name().equals(stepInstance.getStatus())
                || OnboardingStepInstanceStatus.SKIPPED.name().equals(stepInstance.getStatus())) {
            return stepInstance;
        }

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
        String targetUserId = instance.getEffectiveSubjectUserId();
        if (Boolean.TRUE.equals(step.getGrantsStudentRole())) {
            authService.addRolesToUserInternal(targetUserId, List.of("STUDENT"), instance.getInstituteId());
        }
        if (Boolean.TRUE.equals(step.getSendsLoginCredentials())) {
            try {
                authService.sendCredToUsers(List.of(targetUserId));
            } catch (Exception e) {
                log.warn("Failed to send login credentials to {} for onboarding step {}: {}",
                        targetUserId, step.getId(), e.getMessage());
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

    /** Learner-facing variant of {@link #toDto}: also sets learner_can_act for {@code roleKey}. */
    public OnboardingStepInstanceDTO toDtoForRole(OnboardingStepInstance stepInstance, String roleKey) {
        OnboardingStep step = onboardingStepRepository.findById(stepInstance.getStepId()).orElse(null);
        OnboardingStepInstanceDTO dto = OnboardingStepInstanceDTO.fromEntity(stepInstance, step);
        if (step != null) {
            dto.setLearnerCanAct(isActionableForRole(step, roleKey));
        }
        return dto;
    }

    /** Learner-facing variant of {@link #toDtos}: also sets learner_can_act for {@code roleKey} on every step. */
    public List<OnboardingStepInstanceDTO> toDtosForRole(List<OnboardingStepInstance> stepInstances, String roleKey) {
        if (stepInstances.isEmpty()) return List.of();
        Map<String, OnboardingStep> stepsById = onboardingStepRepository
                .findAllById(stepInstances.stream().map(OnboardingStepInstance::getStepId).distinct().toList())
                .stream()
                .collect(Collectors.toMap(OnboardingStep::getId, s -> s));
        return stepInstances.stream()
                .map(si -> {
                    OnboardingStep step = stepsById.get(si.getStepId());
                    OnboardingStepInstanceDTO dto = OnboardingStepInstanceDTO.fromEntity(si, step);
                    if (step != null) {
                        dto.setLearnerCanAct(isActionableForRole(step, roleKey));
                    }
                    return dto;
                })
                .toList();
    }

    /**
     * Whether a caller acting as {@code roleKey} (STUDENT/PARENT) can actually act on this step --
     * false for a create_student-configured step (always admin-only, enforced in
     * {@link #completeStep}); otherwise true only if there's actually something this role may
     * DO on the step: either it has no attached fields and the step-level default itself grants
     * edit (a plain "read this, click complete" step), or at least one attached field resolves
     * editable for this role. Deliberately checks per-FIELD access (not just the step-level
     * default) so an admin who left the step-level default at STUDENT/PARENT can_edit=false but
     * explicitly granted edit on specific fields isn't wrongly locked out -- per
     * {@link OnboardingRoleAccessResolutionService}'s own contract, "a field-level entry (if
     * present) overrides the step-level default", so actionability has to honor that same
     * override, not just the fallback. Used both to decide whether the
     * learner app should block on this step (e.g. gate the dashboard) or let the learner through
     * as "waiting on an admin", AND to enforce server-side in {@link #completeStep} that a
     * non-admin can't complete a step with nothing they're actually permitted to submit.
     */
    public boolean isActionableForRole(OnboardingStep step, String roleKey) {
        if (isCreateStudentConfigured(step)) return false;
        List<OnboardingStepFieldConfigDTO> fieldConfigs = parseFieldConfigs(step.getFieldsConfig());
        if (fieldConfigs.isEmpty()) {
            return roleAccessResolutionService.resolveStepAccess(step.getId(), roleKey).canEdit;
        }
        return fieldConfigs.stream().anyMatch(fc -> roleAccessResolutionService
                .resolveFieldAccess(step.getId(), fc.getInstituteCustomFieldId(), roleKey).canEdit);
    }

    /**
     * This step's fields resolved for {@code roleKey}: filtered to only fields the role can VIEW
     * (a field the role can't see is simply absent, not sent with can_view=false), each carrying
     * whether the role may EDIT it and its already-submitted value if any. Replaces the learner
     * app's previous reliance on the generic (role-unaware) feature-fields lookup, which rendered
     * every field as an editable text input regardless of the caller's actual permission.
     */
    public List<OnboardingResolvedFieldDTO> getResolvedFieldsForRole(String stepInstanceId, String roleKey) {
        OnboardingStepInstance stepInstance = getStepInstance(stepInstanceId);
        OnboardingStep step = onboardingStepRepository.findById(stepInstance.getStepId())
                .orElseThrow(() -> new ResourceNotFoundException("Onboarding step not found: " + stepInstance.getStepId()));
        List<OnboardingStepFieldConfigDTO> fieldConfigs = parseFieldConfigs(step.getFieldsConfig());
        if (fieldConfigs.isEmpty()) return List.of();

        Map<String, String> valueByCustomFieldId = customFieldValuesRepository
                .findBySourceTypeAndSourceId(CustomFieldValueSourceTypeEnum.ONBOARDING_STEP_INSTANCE.name(), stepInstanceId)
                .stream()
                .collect(Collectors.toMap(CustomFieldValues::getCustomFieldId, CustomFieldValues::getValue, (a, b) -> a));

        List<OnboardingResolvedFieldDTO> out = new ArrayList<>();
        for (OnboardingStepFieldConfigDTO fieldConfig : fieldConfigs) {
            Optional<InstituteCustomField> instituteCustomField =
                    instituteCustomFieldRepository.findById(fieldConfig.getInstituteCustomFieldId());
            if (instituteCustomField.isEmpty()) continue;

            OnboardingRoleAccessResolutionService.EffectiveAccess access = roleAccessResolutionService
                    .resolveFieldAccess(step.getId(), fieldConfig.getInstituteCustomFieldId(), roleKey);
            if (!access.canView) continue;

            String customFieldId = instituteCustomField.get().getCustomFieldId();
            String fieldName = customFieldRepository.findById(customFieldId)
                    .map(CustomFields::getFieldName).orElse(null);
            out.add(OnboardingResolvedFieldDTO.builder()
                    .instituteCustomFieldId(fieldConfig.getInstituteCustomFieldId())
                    .fieldName(fieldName)
                    .fieldOrder(fieldConfig.getFieldOrder())
                    .isMandatory(fieldConfig.getIsMandatory())
                    .canEdit(access.canEdit)
                    .value(valueByCustomFieldId.get(customFieldId))
                    .build());
        }
        out.sort(Comparator.comparing(f -> f.getFieldOrder() == null ? 0 : f.getFieldOrder()));
        return out;
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

    private String readPayloadString(Map<String, Object> payload, String key) {
        if (payload == null) return null;
        Object raw = payload.get(key);
        return raw == null ? null : String.valueOf(raw);
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
