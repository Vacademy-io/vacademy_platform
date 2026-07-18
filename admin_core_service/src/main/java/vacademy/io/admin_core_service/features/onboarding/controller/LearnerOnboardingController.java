package vacademy.io.admin_core_service.features.onboarding.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.onboarding.dto.CompleteStepInstanceRequest;
import vacademy.io.admin_core_service.features.onboarding.dto.OnboardingInstanceDTO;
import vacademy.io.admin_core_service.features.onboarding.dto.OnboardingStepInstanceDTO;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.onboarding.entity.OnboardingInstance;
import vacademy.io.admin_core_service.features.onboarding.entity.OnboardingStepInstance;
import vacademy.io.admin_core_service.features.onboarding.service.OnboardingInstanceService;
import vacademy.io.admin_core_service.features.onboarding.service.OnboardingRoleAccessResolutionService;
import vacademy.io.admin_core_service.features.onboarding.service.OnboardingStepInstanceService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.ForbiddenException;

import java.util.List;

/**
 * Learner-app-facing onboarding endpoints. Strictly scoped to the caller's own
 * subject_user_id from the JWT -- never accepts an arbitrary subjectUserId param.
 * v1 covers the subject acting for themself; parent-on-behalf-of-child access is a
 * follow-up (needs the parent/child linkage check via ParentLinkService). The caller's
 * effective role (STUDENT vs PARENT) IS resolved for real, via is_parent on their own
 * auth_service user row -- a subject who happens to be a parent-flagged user acting for
 * themself is in scope today; acting on behalf of a linked child is the deferred part.
 */
@RestController
@RequestMapping("/admin-core-service/learner/onboarding")
@RequiredArgsConstructor
public class LearnerOnboardingController {

    private final OnboardingInstanceService onboardingInstanceService;
    private final OnboardingStepInstanceService onboardingStepInstanceService;
    private final OnboardingRoleAccessResolutionService roleAccessResolutionService;
    private final AuthService authService;

    @GetMapping("/instances")
    public ResponseEntity<List<OnboardingInstanceDTO>> myInstances(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestParam("instituteId") String instituteId) {
        List<OnboardingInstanceDTO> instances = onboardingInstanceService
                .listBySubject(userDetails.getUserId(), instituteId).stream()
                .map(this::toDto).toList();
        return ResponseEntity.ok(instances);
    }

    @GetMapping("/step-instances/{stepInstanceId}")
    public ResponseEntity<OnboardingStepInstanceDTO> getStepInstance(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @PathVariable("stepInstanceId") String stepInstanceId) {
        OnboardingStepInstance stepInstance = onboardingStepInstanceService.getStepInstance(stepInstanceId);
        assertOwnsStepInstance(userDetails, stepInstance);
        return ResponseEntity.ok(onboardingStepInstanceService.toDto(stepInstance));
    }

    @PostMapping("/step-instances/{stepInstanceId}/submit")
    public ResponseEntity<OnboardingStepInstanceDTO> submitStep(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @PathVariable("stepInstanceId") String stepInstanceId,
            @RequestBody CompleteStepInstanceRequest request) {
        OnboardingStepInstance stepInstance = onboardingStepInstanceService.getStepInstance(stepInstanceId);
        assertOwnsStepInstance(userDetails, stepInstance);
        String roleKey = resolveCallerRoleKey(userDetails);
        return ResponseEntity.ok(onboardingStepInstanceService.toDto(
                onboardingStepInstanceService.completeStep(stepInstanceId, request.getPayload(),
                        roleKey, userDetails.getUserId())));
    }

    private void assertOwnsStepInstance(CustomUserDetails userDetails, OnboardingStepInstance stepInstance) {
        OnboardingInstance instance = onboardingInstanceService.getInstance(stepInstance.getOnboardingInstanceId());
        if (!instance.getSubjectUserId().equals(userDetails.getUserId())) {
            throw new ForbiddenException("Not authorized to access this onboarding step");
        }
    }

    /**
     * STUDENT vs PARENT, resolved for real from the caller's own auth_service user row
     * (is_parent) via {@link OnboardingRoleAccessResolutionService#resolveRoleKey} -- not
     * hardcoded. A caller not found in auth_service (shouldn't happen for an authenticated
     * JWT) safely falls back to STUDENT, the more restrictive of the two non-admin roles.
     */
    private String resolveCallerRoleKey(CustomUserDetails userDetails) {
        List<UserDTO> users = authService.getUsersFromAuthServiceByUserIds(List.of(userDetails.getUserId()));
        UserDTO caller = users.isEmpty() ? null : users.get(0);
        return roleAccessResolutionService.resolveRoleKey(false, caller);
    }

    private OnboardingInstanceDTO toDto(OnboardingInstance instance) {
        OnboardingInstanceDTO dto = OnboardingInstanceDTO.fromEntity(instance);
        dto.setStepInstances(onboardingStepInstanceService.toDtos(
                onboardingStepInstanceService.listStepInstances(instance.getId())));
        return dto;
    }
}
