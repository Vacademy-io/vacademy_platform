package vacademy.io.admin_core_service.features.onboarding.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.onboarding.dto.CreateOnboardingFlowRequest;
import vacademy.io.admin_core_service.features.onboarding.dto.OnboardingFlowDTO;
import vacademy.io.admin_core_service.features.onboarding.dto.OnboardingStepDTO;
import vacademy.io.admin_core_service.features.onboarding.dto.UpdateOnboardingFlowRequest;
import vacademy.io.admin_core_service.features.onboarding.entity.OnboardingFlow;
import vacademy.io.admin_core_service.features.onboarding.service.OnboardingFlowService;
import vacademy.io.admin_core_service.features.onboarding.service.OnboardingStepService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

/**
 * Every endpoint here is institute-admin-only -- flows are configuration, not learner-facing
 * data. {@link InstituteAccessValidator#requireAdminAccess} is called on every method, resolving
 * the institute from the flow entity itself where the request doesn't carry an instituteId
 * param directly (getFlow/updateFlow/archiveFlow).
 */
@RestController
@RequestMapping("/admin-core-service/onboarding/flows")
@RequiredArgsConstructor
public class OnboardingFlowController {

    private final OnboardingFlowService onboardingFlowService;
    private final OnboardingStepService onboardingStepService;
    private final InstituteAccessValidator instituteAccessValidator;

    @PostMapping
    public ResponseEntity<OnboardingFlowDTO> createFlow(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestParam("instituteId") String instituteId,
            @RequestBody CreateOnboardingFlowRequest request) {
        instituteAccessValidator.requireAdminAccess(userDetails, instituteId);
        OnboardingFlow flow = onboardingFlowService.createFlow(instituteId, userDetails.getUserId(), request);
        return ResponseEntity.ok(OnboardingFlowDTO.fromEntity(flow));
    }

    @GetMapping
    public ResponseEntity<List<OnboardingFlowDTO>> listFlows(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "status", required = false) String status) {
        instituteAccessValidator.requireAdminAccess(userDetails, instituteId);
        // Populate `steps` so the flow list's step-count column is accurate -- fromEntity()
        // alone never sets it, since OnboardingFlow itself carries no steps relationship.
        List<OnboardingFlowDTO> flows = onboardingFlowService.listFlows(instituteId, status).stream()
                .map(this::toDtoWithSteps).toList();
        return ResponseEntity.ok(flows);
    }

    @GetMapping("/{flowId}")
    public ResponseEntity<OnboardingFlowDTO> getFlow(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @PathVariable("flowId") String flowId) {
        OnboardingFlow flow = onboardingFlowService.getFlow(flowId);
        instituteAccessValidator.requireAdminAccess(userDetails, flow.getInstituteId());
        return ResponseEntity.ok(toDtoWithSteps(flow));
    }

    @PutMapping("/{flowId}")
    public ResponseEntity<OnboardingFlowDTO> updateFlow(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @PathVariable("flowId") String flowId,
            @RequestBody UpdateOnboardingFlowRequest request) {
        instituteAccessValidator.requireAdminAccess(userDetails, onboardingFlowService.getFlow(flowId).getInstituteId());
        return ResponseEntity.ok(OnboardingFlowDTO.fromEntity(onboardingFlowService.updateFlow(flowId, request)));
    }

    @DeleteMapping("/{flowId}")
    public ResponseEntity<Void> archiveFlow(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @PathVariable("flowId") String flowId) {
        instituteAccessValidator.requireAdminAccess(userDetails, onboardingFlowService.getFlow(flowId).getInstituteId());
        onboardingFlowService.archiveFlow(flowId);
        return ResponseEntity.noContent().build();
    }

    private OnboardingFlowDTO toDtoWithSteps(OnboardingFlow flow) {
        OnboardingFlowDTO dto = OnboardingFlowDTO.fromEntity(flow);
        dto.setSteps(onboardingStepService.listSteps(flow.getId()).stream()
                .map(OnboardingStepDTO::fromEntity).toList());
        return dto;
    }
}
