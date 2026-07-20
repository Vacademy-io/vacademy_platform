package vacademy.io.admin_core_service.features.onboarding.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.onboarding.dto.CompleteStepInstanceRequest;
import vacademy.io.admin_core_service.features.onboarding.dto.OnboardingStepInstanceDTO;
import vacademy.io.admin_core_service.features.onboarding.dto.OnboardingSubmittedFieldDTO;
import vacademy.io.admin_core_service.features.onboarding.dto.SkipStepInstanceRequest;
import vacademy.io.admin_core_service.features.onboarding.entity.OnboardingInstance;
import vacademy.io.admin_core_service.features.onboarding.entity.OnboardingStepInstance;
import vacademy.io.admin_core_service.features.onboarding.enums.OnboardingRoleKey;
import vacademy.io.admin_core_service.features.onboarding.service.OnboardingInstanceService;
import vacademy.io.admin_core_service.features.onboarding.service.OnboardingStepInstanceService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

/**
 * Admin-facing step-instance actions -- every method here previously ran with ZERO institute or
 * role verification: completeStep/skipStep hardcoded the caller as ADMIN regardless of who was
 * actually calling, and getSubmittedValues had no ownership check at all. Any authenticated
 * platform account (any institute, any role) could complete/skip/read another institute's
 * onboarding steps. Every method now resolves the real institute via the step instance's parent
 * onboarding_instance and requires the caller to actually be an institute admin there.
 */
@RestController
@RequestMapping("/admin-core-service/onboarding/step-instances")
@RequiredArgsConstructor
public class OnboardingStepInstanceController {

    private final OnboardingStepInstanceService onboardingStepInstanceService;
    private final OnboardingInstanceService onboardingInstanceService;
    private final InstituteAccessValidator instituteAccessValidator;

    @PostMapping("/{stepInstanceId}/complete")
    public ResponseEntity<OnboardingStepInstanceDTO> completeStep(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @PathVariable("stepInstanceId") String stepInstanceId,
            @RequestBody CompleteStepInstanceRequest request) {
        requireAdminForStepInstance(userDetails, stepInstanceId);
        return ResponseEntity.ok(onboardingStepInstanceService.toDto(
                onboardingStepInstanceService.completeStep(stepInstanceId, request.getPayload(),
                        OnboardingRoleKey.ADMIN.name(), userDetails.getUserId())));
    }

    @PostMapping("/{stepInstanceId}/skip")
    public ResponseEntity<OnboardingStepInstanceDTO> skipStep(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @PathVariable("stepInstanceId") String stepInstanceId,
            @RequestBody SkipStepInstanceRequest request) {
        requireAdminForStepInstance(userDetails, stepInstanceId);
        return ResponseEntity.ok(onboardingStepInstanceService.toDto(
                onboardingStepInstanceService.skipStep(stepInstanceId, request.getReason(), userDetails.getUserId())));
    }

    /** Actual submitted values for a FORM step instance -- previously only field names were viewable. */
    @GetMapping("/{stepInstanceId}/submitted-values")
    public ResponseEntity<List<OnboardingSubmittedFieldDTO>> getSubmittedValues(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @PathVariable("stepInstanceId") String stepInstanceId) {
        requireAdminForStepInstance(userDetails, stepInstanceId);
        return ResponseEntity.ok(onboardingStepInstanceService.getSubmittedFieldValues(stepInstanceId));
    }

    private void requireAdminForStepInstance(CustomUserDetails userDetails, String stepInstanceId) {
        OnboardingStepInstance stepInstance = onboardingStepInstanceService.getStepInstance(stepInstanceId);
        OnboardingInstance instance = onboardingInstanceService.getInstance(stepInstance.getOnboardingInstanceId());
        instituteAccessValidator.requireAdminAccess(userDetails, instance.getInstituteId());
    }
}
