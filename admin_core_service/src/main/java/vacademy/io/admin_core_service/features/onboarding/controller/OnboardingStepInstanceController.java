package vacademy.io.admin_core_service.features.onboarding.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.onboarding.dto.CompleteStepInstanceRequest;
import vacademy.io.admin_core_service.features.onboarding.dto.OnboardingStepInstanceDTO;
import vacademy.io.admin_core_service.features.onboarding.dto.SkipStepInstanceRequest;
import vacademy.io.admin_core_service.features.onboarding.enums.OnboardingRoleKey;
import vacademy.io.admin_core_service.features.onboarding.service.OnboardingStepInstanceService;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/onboarding/step-instances")
@RequiredArgsConstructor
public class OnboardingStepInstanceController {

    private final OnboardingStepInstanceService onboardingStepInstanceService;

    @PostMapping("/{stepInstanceId}/complete")
    public ResponseEntity<OnboardingStepInstanceDTO> completeStep(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @PathVariable("stepInstanceId") String stepInstanceId,
            @RequestBody CompleteStepInstanceRequest request) {
        return ResponseEntity.ok(onboardingStepInstanceService.toDto(
                onboardingStepInstanceService.completeStep(stepInstanceId, request.getPayload(),
                        OnboardingRoleKey.ADMIN.name(), userDetails.getUserId())));
    }

    @PostMapping("/{stepInstanceId}/skip")
    public ResponseEntity<OnboardingStepInstanceDTO> skipStep(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @PathVariable("stepInstanceId") String stepInstanceId,
            @RequestBody SkipStepInstanceRequest request) {
        return ResponseEntity.ok(onboardingStepInstanceService.toDto(
                onboardingStepInstanceService.skipStep(stepInstanceId, request.getReason(), userDetails.getUserId())));
    }
}
