package vacademy.io.admin_core_service.features.onboarding.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.onboarding.entity.OnboardingInstance;
import vacademy.io.admin_core_service.features.onboarding.entity.OnboardingStep;
import vacademy.io.admin_core_service.features.onboarding.enums.OnboardingInstanceStatus;
import vacademy.io.admin_core_service.features.onboarding.repository.OnboardingInstanceRepository;
import vacademy.io.admin_core_service.features.onboarding.repository.OnboardingStepRepository;
import vacademy.io.admin_core_service.features.workflow.enums.WorkflowTriggerEvent;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowTriggerService;
import vacademy.io.common.exceptions.ResourceNotFoundException;

import java.util.Date;
import java.util.List;
import java.util.Optional;

/**
 * Starts and looks up onboarding_instance runs. Manual starts always name one explicit
 * flow_id; auto-starts (via the workflow engine's START_ONBOARDING_FLOW node) also always
 * name one explicit flow_id in the node's config -- no attribute-based flow matching in v1.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OnboardingInstanceService {

    private final OnboardingInstanceRepository onboardingInstanceRepository;
    private final OnboardingStepRepository onboardingStepRepository;
    private final OnboardingStepInstanceService stepInstanceService;
    private final OnboardingTriggerContextBuilder triggerContextBuilder;

    @Autowired
    @Lazy
    private WorkflowTriggerService workflowTriggerService;

    @Transactional
    public OnboardingInstance startInstance(String flowId, String subjectUserId, String instituteId,
                                             String startedBy, String startedByUserId,
                                             String sourceEventName, String sourceEventId) {
        OnboardingInstance instance = OnboardingInstance.builder()
                .flowId(flowId)
                .instituteId(instituteId)
                .subjectUserId(subjectUserId)
                .status(OnboardingInstanceStatus.IN_PROGRESS.name())
                .startedBy(startedBy)
                .startedByUserId(startedByUserId)
                .sourceEventName(sourceEventName)
                .sourceEventId(sourceEventId)
                .startedAt(new Date())
                .build();
        instance = onboardingInstanceRepository.save(instance);
        final OnboardingInstance savedInstance = instance;

        try {
            workflowTriggerService.handleTriggerEvents(
                    WorkflowTriggerEvent.ONBOARDING_FLOW_STARTED.name(),
                    flowId,
                    instituteId,
                    triggerContextBuilder.forFlowChange(instance, "STARTED"));
        } catch (Exception e) {
            log.warn("Failed to fire ONBOARDING_FLOW_STARTED for flow {}: {}", flowId, e.getMessage());
        }

        Optional<OnboardingStep> firstStep =
                onboardingStepRepository.findFirstByFlowIdAndStatusOrderByStepOrderAsc(flowId, "ACTIVE");
        firstStep.ifPresent(step -> stepInstanceService.enterStep(savedInstance, step));

        return savedInstance;
    }

    public OnboardingInstance getInstance(String instanceId) {
        return onboardingInstanceRepository.findById(instanceId)
                .orElseThrow(() -> new ResourceNotFoundException("Onboarding instance not found: " + instanceId));
    }

    public List<OnboardingInstance> listBySubject(String subjectUserId, String instituteId) {
        return onboardingInstanceRepository.findBySubjectUserIdAndInstituteId(subjectUserId, instituteId);
    }
}
