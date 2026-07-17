package vacademy.io.admin_core_service.features.onboarding.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.onboarding.dto.CreateOnboardingFlowRequest;
import vacademy.io.admin_core_service.features.onboarding.dto.UpdateOnboardingFlowRequest;
import vacademy.io.admin_core_service.features.onboarding.entity.OnboardingFlow;
import vacademy.io.admin_core_service.features.onboarding.enums.OnboardingFlowStatus;
import vacademy.io.admin_core_service.features.onboarding.enums.OnboardingStartedBy;
import vacademy.io.admin_core_service.features.onboarding.repository.OnboardingFlowRepository;
import vacademy.io.common.exceptions.ResourceNotFoundException;

import java.util.List;

@Service
@RequiredArgsConstructor
public class OnboardingFlowService {

    private final OnboardingFlowRepository onboardingFlowRepository;

    public OnboardingFlow createFlow(String instituteId, String createdByUserId, CreateOnboardingFlowRequest request) {
        OnboardingFlow flow = OnboardingFlow.builder()
                .instituteId(instituteId)
                .name(request.getName())
                .description(request.getDescription())
                .status(OnboardingFlowStatus.DRAFT.name())
                .startMode(StringUtils.hasText(request.getStartMode()) ? request.getStartMode() : OnboardingStartedBy.MANUAL.name())
                .createdByUserId(createdByUserId)
                .build();
        return onboardingFlowRepository.save(flow);
    }

    public List<OnboardingFlow> listFlows(String instituteId, String status) {
        return StringUtils.hasText(status)
                ? onboardingFlowRepository.findByInstituteIdAndStatus(instituteId, status)
                : onboardingFlowRepository.findByInstituteId(instituteId);
    }

    public OnboardingFlow getFlow(String flowId) {
        return onboardingFlowRepository.findById(flowId)
                .orElseThrow(() -> new ResourceNotFoundException("Onboarding flow not found: " + flowId));
    }

    public OnboardingFlow updateFlow(String flowId, UpdateOnboardingFlowRequest request) {
        OnboardingFlow flow = getFlow(flowId);
        if (StringUtils.hasText(request.getName())) flow.setName(request.getName());
        if (request.getDescription() != null) flow.setDescription(request.getDescription());
        if (StringUtils.hasText(request.getStatus())) flow.setStatus(request.getStatus());
        if (StringUtils.hasText(request.getStartMode())) flow.setStartMode(request.getStartMode());
        return onboardingFlowRepository.save(flow);
    }

    public void archiveFlow(String flowId) {
        OnboardingFlow flow = getFlow(flowId);
        flow.setStatus(OnboardingFlowStatus.ARCHIVED.name());
        onboardingFlowRepository.save(flow);
    }
}
