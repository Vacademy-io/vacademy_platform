package vacademy.io.admin_core_service.features.onboarding.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.onboarding.dto.CompleteStepInstanceRequest;
import vacademy.io.admin_core_service.features.onboarding.dto.OnboardingInstanceDTO;
import vacademy.io.admin_core_service.features.onboarding.dto.OnboardingStepInstanceDTO;
import vacademy.io.admin_core_service.features.onboarding.entity.OnboardingInstance;
import vacademy.io.admin_core_service.features.onboarding.entity.OnboardingStepInstance;
import vacademy.io.admin_core_service.features.onboarding.enums.OnboardingRoleKey;
import vacademy.io.admin_core_service.features.onboarding.service.OnboardingInstanceService;
import vacademy.io.admin_core_service.features.onboarding.service.OnboardingStepInstanceService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.ForbiddenException;

import java.util.List;

/**
 * Learner-app-facing onboarding endpoints. Strictly scoped to the caller's own
 * subject_user_id from the JWT -- never accepts an arbitrary subjectUserId param.
 * v1 covers the subject acting for themself; parent-on-behalf-of-child access is a
 * follow-up (needs the parent/child linkage check via ParentLinkService).
 */
@RestController
@RequestMapping("/admin-core-service/learner/onboarding")
@RequiredArgsConstructor
public class LearnerOnboardingController {

    private final OnboardingInstanceService onboardingInstanceService;
    private final OnboardingStepInstanceService onboardingStepInstanceService;

    @GetMapping("/instances")
    public ResponseEntity<List<OnboardingInstanceDTO>> myInstances(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestParam("instituteId") String instituteId) {
        List<OnboardingInstanceDTO> instances = onboardingInstanceService
                .listBySubject(userDetails.getUserId(), instituteId).stream()
                .map(OnboardingInstanceDTO::fromEntity).toList();
        return ResponseEntity.ok(instances);
    }

    @GetMapping("/step-instances/{stepInstanceId}")
    public ResponseEntity<OnboardingStepInstanceDTO> getStepInstance(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @PathVariable("stepInstanceId") String stepInstanceId) {
        OnboardingStepInstance stepInstance = onboardingStepInstanceService.getStepInstance(stepInstanceId);
        assertOwnsStepInstance(userDetails, stepInstance);
        return ResponseEntity.ok(OnboardingStepInstanceDTO.fromEntity(stepInstance));
    }

    @PostMapping("/step-instances/{stepInstanceId}/submit")
    public ResponseEntity<OnboardingStepInstanceDTO> submitStep(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @PathVariable("stepInstanceId") String stepInstanceId,
            @RequestBody CompleteStepInstanceRequest request) {
        OnboardingStepInstance stepInstance = onboardingStepInstanceService.getStepInstance(stepInstanceId);
        assertOwnsStepInstance(userDetails, stepInstance);
        return ResponseEntity.ok(OnboardingStepInstanceDTO.fromEntity(
                onboardingStepInstanceService.completeStep(stepInstanceId, request.getPayload(),
                        OnboardingRoleKey.STUDENT.name(), userDetails.getUserId())));
    }

    private void assertOwnsStepInstance(CustomUserDetails userDetails, OnboardingStepInstance stepInstance) {
        OnboardingInstance instance = onboardingInstanceService.getInstance(stepInstance.getOnboardingInstanceId());
        if (!instance.getSubjectUserId().equals(userDetails.getUserId())) {
            throw new ForbiddenException("Not authorized to access this onboarding step");
        }
    }
}
