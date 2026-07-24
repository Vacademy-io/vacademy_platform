package vacademy.io.admin_core_service.features.onboarding.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.onboarding.dto.OnboardingInstanceDTO;
import vacademy.io.admin_core_service.features.onboarding.dto.OnboardingInstanceSummaryDTO;
import vacademy.io.admin_core_service.features.onboarding.dto.StartOnboardingInstanceRequest;
import vacademy.io.admin_core_service.features.onboarding.entity.OnboardingInstance;
import vacademy.io.admin_core_service.features.onboarding.enums.OnboardingStartedBy;
import vacademy.io.admin_core_service.features.onboarding.service.OnboardingInstanceService;
import vacademy.io.admin_core_service.features.onboarding.service.OnboardingStepInstanceService;
import vacademy.io.common.auth.config.PageConstants;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

/**
 * Admin-facing instance endpoints -- institute-admin-only (the learner app has its own,
 * separately-scoped {@code LearnerOnboardingController}, which resolves "who's asking" from the
 * JWT and never trusts a client-supplied subject/institute id the way these do).
 */
@RestController
@RequestMapping("/admin-core-service/onboarding/instances")
@RequiredArgsConstructor
public class OnboardingInstanceController {

    private final OnboardingInstanceService onboardingInstanceService;
    private final OnboardingStepInstanceService onboardingStepInstanceService;
    private final AuthService authService;
    private final InstituteAccessValidator instituteAccessValidator;

    @PostMapping
    public ResponseEntity<OnboardingInstanceDTO> startInstance(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestParam("instituteId") String instituteId,
            @RequestBody StartOnboardingInstanceRequest request) {
        instituteAccessValidator.requireAdminAccess(userDetails, instituteId);
        OnboardingInstance instance = onboardingInstanceService.startInstance(
                request.getFlowId(), request.getSubjectUserId(), instituteId,
                OnboardingStartedBy.MANUAL.name(), userDetails.getUserId(), null, null);
        return ResponseEntity.ok(toDto(instance));
    }

    @GetMapping("/{instanceId}")
    public ResponseEntity<OnboardingInstanceDTO> getInstance(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @PathVariable("instanceId") String instanceId) {
        OnboardingInstance instance = onboardingInstanceService.getInstance(instanceId);
        instituteAccessValidator.requireAdminAccess(userDetails, instance.getInstituteId());
        return ResponseEntity.ok(toDto(instance));
    }

    @GetMapping
    public ResponseEntity<List<OnboardingInstanceDTO>> listBySubject(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestParam("subjectUserId") String subjectUserId,
            @RequestParam("instituteId") String instituteId) {
        instituteAccessValidator.requireAdminAccess(userDetails, instituteId);
        List<OnboardingInstanceDTO> instances = onboardingInstanceService.listBySubject(subjectUserId, instituteId)
                .stream().map(this::toDto).toList();
        return ResponseEntity.ok(instances);
    }

    /** Student side-view "Onboarding" sub-tab: same payload as list, dedicated path for clarity. */
    @GetMapping("/side-view")
    public ResponseEntity<List<OnboardingInstanceDTO>> sideView(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestParam("subjectUserId") String subjectUserId,
            @RequestParam("instituteId") String instituteId) {
        return listBySubject(userDetails, subjectUserId, instituteId);
    }

    /**
     * Onboarding management dashboard: every instance for the institute (optionally filtered to
     * one flow/status), newest-first, enriched with subject/flow/current-step names -- one place
     * to see who's pending, on which flow, and at which step, without opening each side-view.
     */
    @GetMapping("/dashboard")
    public ResponseEntity<Page<OnboardingInstanceSummaryDTO>> dashboard(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "flowId", required = false) String flowId,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(name = "pageNo", defaultValue = PageConstants.DEFAULT_PAGE_NUMBER) int pageNo,
            @RequestParam(name = "pageSize", defaultValue = PageConstants.DEFAULT_PAGE_SIZE) int pageSize) {
        instituteAccessValidator.requireAdminAccess(userDetails, instituteId);
        return ResponseEntity.ok(
                onboardingInstanceService.searchInstances(instituteId, flowId, status, pageNo, pageSize));
    }

    private OnboardingInstanceDTO toDto(OnboardingInstance instance) {
        OnboardingInstanceDTO dto = OnboardingInstanceDTO.fromEntity(instance);
        dto.setStepInstances(onboardingStepInstanceService.toDtos(
                onboardingStepInstanceService.listStepInstances(instance.getId())));
        if (StringUtils.hasText(instance.getResolvedSubjectUserId())) {
            List<UserDTO> resolved = authService.getUsersFromAuthServiceByUserIds(
                    List.of(instance.getResolvedSubjectUserId()));
            if (!resolved.isEmpty()) {
                dto.setResolvedSubjectName(resolved.get(0).getFullName());
                dto.setResolvedSubjectEmail(resolved.get(0).getEmail());
            }
        }
        return dto;
    }
}
