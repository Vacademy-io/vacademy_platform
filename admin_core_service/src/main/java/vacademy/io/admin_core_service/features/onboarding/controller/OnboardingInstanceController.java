package vacademy.io.admin_core_service.features.onboarding.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.onboarding.dto.OnboardingInstanceDTO;
import vacademy.io.admin_core_service.features.onboarding.dto.OnboardingStepInstanceDTO;
import vacademy.io.admin_core_service.features.onboarding.dto.StartOnboardingInstanceRequest;
import vacademy.io.admin_core_service.features.onboarding.entity.OnboardingInstance;
import vacademy.io.admin_core_service.features.onboarding.enums.OnboardingStartedBy;
import vacademy.io.admin_core_service.features.onboarding.service.OnboardingInstanceService;
import vacademy.io.admin_core_service.features.onboarding.service.OnboardingStepInstanceService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/onboarding/instances")
@RequiredArgsConstructor
public class OnboardingInstanceController {

    private final OnboardingInstanceService onboardingInstanceService;
    private final OnboardingStepInstanceService onboardingStepInstanceService;

    @PostMapping
    public ResponseEntity<OnboardingInstanceDTO> startInstance(
            @RequestParam("user") CustomUserDetails userDetails,
            @RequestParam("instituteId") String instituteId,
            @RequestBody StartOnboardingInstanceRequest request) {
        OnboardingInstance instance = onboardingInstanceService.startInstance(
                request.getFlowId(), request.getSubjectUserId(), instituteId,
                OnboardingStartedBy.MANUAL.name(), userDetails.getUserId(), null, null);
        return ResponseEntity.ok(toDto(instance));
    }

    @GetMapping("/{instanceId}")
    public ResponseEntity<OnboardingInstanceDTO> getInstance(@PathVariable("instanceId") String instanceId) {
        return ResponseEntity.ok(toDto(onboardingInstanceService.getInstance(instanceId)));
    }

    @GetMapping
    public ResponseEntity<List<OnboardingInstanceDTO>> listBySubject(
            @RequestParam("subjectUserId") String subjectUserId,
            @RequestParam("instituteId") String instituteId) {
        List<OnboardingInstanceDTO> instances = onboardingInstanceService.listBySubject(subjectUserId, instituteId)
                .stream().map(this::toDto).toList();
        return ResponseEntity.ok(instances);
    }

    /** Student side-view "Onboarding" sub-tab: same payload as list, dedicated path for clarity. */
    @GetMapping("/side-view")
    public ResponseEntity<List<OnboardingInstanceDTO>> sideView(
            @RequestParam("subjectUserId") String subjectUserId,
            @RequestParam("instituteId") String instituteId) {
        return listBySubject(subjectUserId, instituteId);
    }

    private OnboardingInstanceDTO toDto(OnboardingInstance instance) {
        OnboardingInstanceDTO dto = OnboardingInstanceDTO.fromEntity(instance);
        List<OnboardingStepInstanceDTO> stepInstances = onboardingStepInstanceService
                .listStepInstances(instance.getId()).stream()
                .map(OnboardingStepInstanceDTO::fromEntity).toList();
        dto.setStepInstances(stepInstances);
        return dto;
    }
}
