package vacademy.io.admin_core_service.features.onboarding.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
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
import vacademy.io.common.exceptions.ResourceNotFoundException;

import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Optional;

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
            throw new IllegalStateException("Step is not optional and cannot be skipped: " + step.getId());
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
}
