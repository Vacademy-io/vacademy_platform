package vacademy.io.admin_core_service.features.onboarding.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.onboarding.dto.OnboardingStepDTO;
import vacademy.io.admin_core_service.features.onboarding.dto.OnboardingStepTriggerDTO;
import vacademy.io.admin_core_service.features.onboarding.dto.ReorderStepsRequest;
import vacademy.io.admin_core_service.features.onboarding.service.OnboardingStepService;
import vacademy.io.admin_core_service.features.onboarding.service.OnboardingStepWorkflowTriggerService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/admin-core-service/onboarding/flows/{flowId}/steps")
@RequiredArgsConstructor
public class OnboardingStepController {

    private final OnboardingStepService onboardingStepService;
    private final OnboardingStepWorkflowTriggerService onboardingStepWorkflowTriggerService;

    @PostMapping
    public ResponseEntity<OnboardingStepDTO> createStep(
            @RequestParam("instituteId") String instituteId,
            @PathVariable("flowId") String flowId,
            @RequestBody OnboardingStepDTO request) {
        return ResponseEntity.ok(OnboardingStepDTO.fromEntity(
                onboardingStepService.createStep(instituteId, flowId, request)));
    }

    @GetMapping
    public ResponseEntity<List<OnboardingStepDTO>> listSteps(@PathVariable("flowId") String flowId) {
        List<OnboardingStepDTO> steps = onboardingStepService.listSteps(flowId).stream()
                .map(OnboardingStepDTO::fromEntity).toList();
        return ResponseEntity.ok(steps);
    }

    @PutMapping("/{stepId}")
    public ResponseEntity<OnboardingStepDTO> updateStep(
            @RequestParam("instituteId") String instituteId,
            @PathVariable("stepId") String stepId,
            @RequestBody OnboardingStepDTO request) {
        return ResponseEntity.ok(OnboardingStepDTO.fromEntity(
                onboardingStepService.updateStep(instituteId, stepId, request)));
    }

    @DeleteMapping("/{stepId}")
    public ResponseEntity<Void> deleteStep(@PathVariable("stepId") String stepId) {
        onboardingStepService.deleteStep(stepId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/reorder")
    public ResponseEntity<Void> reorderSteps(@RequestBody ReorderStepsRequest request) {
        onboardingStepService.reorderSteps(request);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{stepId}/workflow-triggers")
    public ResponseEntity<List<OnboardingStepTriggerDTO>> getStepWorkflowTriggers(
            @PathVariable("stepId") String stepId) {
        return ResponseEntity.ok(onboardingStepWorkflowTriggerService.getStepWorkflowTriggers(stepId));
    }

    @PostMapping("/{stepId}/workflow-triggers")
    public ResponseEntity<Map<String, Object>> saveStepWorkflowTriggers(
            @RequestParam("instituteId") String instituteId,
            @PathVariable("stepId") String stepId,
            @RequestBody List<OnboardingStepTriggerDTO> triggers) {
        return ResponseEntity.ok(
                onboardingStepWorkflowTriggerService.saveStepWorkflowTriggers(instituteId, stepId, triggers));
    }
}
