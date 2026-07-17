package vacademy.io.admin_core_service.features.onboarding.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.onboarding.dto.CreateOnboardingFlowRequest;
import vacademy.io.admin_core_service.features.onboarding.dto.OnboardingFlowDTO;
import vacademy.io.admin_core_service.features.onboarding.dto.UpdateOnboardingFlowRequest;
import vacademy.io.admin_core_service.features.onboarding.entity.OnboardingFlow;
import vacademy.io.admin_core_service.features.onboarding.service.OnboardingFlowService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/onboarding/flows")
@RequiredArgsConstructor
public class OnboardingFlowController {

    private final OnboardingFlowService onboardingFlowService;

    @PostMapping
    public ResponseEntity<OnboardingFlowDTO> createFlow(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestParam("instituteId") String instituteId,
            @RequestBody CreateOnboardingFlowRequest request) {
        OnboardingFlow flow = onboardingFlowService.createFlow(instituteId, userDetails.getUserId(), request);
        return ResponseEntity.ok(OnboardingFlowDTO.fromEntity(flow));
    }

    @GetMapping
    public ResponseEntity<List<OnboardingFlowDTO>> listFlows(
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "status", required = false) String status) {
        List<OnboardingFlowDTO> flows = onboardingFlowService.listFlows(instituteId, status).stream()
                .map(OnboardingFlowDTO::fromEntity).toList();
        return ResponseEntity.ok(flows);
    }

    @GetMapping("/{flowId}")
    public ResponseEntity<OnboardingFlowDTO> getFlow(@PathVariable("flowId") String flowId) {
        return ResponseEntity.ok(OnboardingFlowDTO.fromEntity(onboardingFlowService.getFlow(flowId)));
    }

    @PutMapping("/{flowId}")
    public ResponseEntity<OnboardingFlowDTO> updateFlow(
            @PathVariable("flowId") String flowId,
            @RequestBody UpdateOnboardingFlowRequest request) {
        return ResponseEntity.ok(OnboardingFlowDTO.fromEntity(onboardingFlowService.updateFlow(flowId, request)));
    }

    @DeleteMapping("/{flowId}")
    public ResponseEntity<Void> archiveFlow(@PathVariable("flowId") String flowId) {
        onboardingFlowService.archiveFlow(flowId);
        return ResponseEntity.noContent().build();
    }
}
