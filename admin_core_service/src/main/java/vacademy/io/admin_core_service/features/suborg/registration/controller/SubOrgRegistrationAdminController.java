package vacademy.io.admin_core_service.features.suborg.registration.controller;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.suborg.registration.dto.CreateRegistrationTemplateDTO;
import vacademy.io.admin_core_service.features.suborg.registration.dto.SubOrgRegistrationFlowDTOs.RegistrationListItemDTO;
import vacademy.io.admin_core_service.features.suborg.registration.dto.SubOrgRegistrationFlowDTOs.TemplateListItemDTO;
import vacademy.io.admin_core_service.features.suborg.registration.dto.TemplateDetailDTO;
import vacademy.io.admin_core_service.features.suborg.registration.service.SubOrgRegistrationTemplateService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.repository.UserRoleRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;
import java.util.Map;

/** Admin-side management of open sub-org registration templates. */
@RestController
@RequestMapping("/admin-core-service/institute/v1/sub-org-registration")
@RequiredArgsConstructor
@Tag(name = "Sub-Org Registration Templates", description = "Create/list open self-registration links")
public class SubOrgRegistrationAdminController {

    private static final String ROLE_NAME_ADMIN = "ADMIN";

    private final SubOrgRegistrationTemplateService templateService;
    private final UserRoleRepository userRoleRepository;
    private final InstituteRepository instituteRepository;

    @PostMapping("/template/create")
    public ResponseEntity<Map<String, Object>> createTemplate(
            @RequestBody CreateRegistrationTemplateDTO request,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute(value = "user", required = false) CustomUserDetails user) {
        assertInstituteAdmin(user, instituteId);
        return ResponseEntity.ok(templateService.createTemplate(request, instituteId));
    }

    @GetMapping("/template/list")
    public ResponseEntity<List<TemplateListItemDTO>> listTemplates(
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute(value = "user", required = false) CustomUserDetails user) {
        assertInstituteAdmin(user, instituteId);
        return ResponseEntity.ok(templateService.listTemplates(instituteId));
    }

    @GetMapping("/template/{templateId}/detail")
    public ResponseEntity<TemplateDetailDTO> getTemplateDetail(
            @PathVariable("templateId") String templateId,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute(value = "user", required = false) CustomUserDetails user) {
        assertInstituteAdmin(user, instituteId);
        return ResponseEntity.ok(templateService.getTemplateDetail(templateId, instituteId));
    }

    @PutMapping("/template/{templateId}")
    public ResponseEntity<Map<String, Object>> updateTemplate(
            @PathVariable("templateId") String templateId,
            @RequestBody CreateRegistrationTemplateDTO request,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute(value = "user", required = false) CustomUserDetails user) {
        assertInstituteAdmin(user, instituteId);
        return ResponseEntity.ok(templateService.updateTemplate(templateId, instituteId, request));
    }

    @PatchMapping("/template/{templateId}/status")
    public ResponseEntity<Map<String, Object>> updateStatus(
            @PathVariable("templateId") String templateId,
            @RequestParam("status") String status,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute(value = "user", required = false) CustomUserDetails user) {
        assertInstituteAdmin(user, instituteId);
        return ResponseEntity.ok(templateService.updateStatus(templateId, status, instituteId));
    }

    @GetMapping("/registrations")
    public ResponseEntity<Page<RegistrationListItemDTO>> listRegistrations(
            @RequestParam("templateInviteId") String templateInviteId,
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "city", required = false) String city,
            @RequestParam(value = "state", required = false) String state,
            @RequestParam(value = "pincode", required = false) String pincode,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "10") int size,
            @RequestAttribute(value = "user", required = false) CustomUserDetails user) {
        assertInstituteAdmin(user, instituteId);
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return ResponseEntity.ok(templateService.listRegistrations(
                templateInviteId, instituteId, city, state, pincode, pageable));
    }

    // ── Authorization guard ──────────────────────────────────────────────────

    /**
     * Asserts the caller is allowed to manage sub-org registration templates for
     * the given institute. Mirrors WhiteLabelService#assertInstituteAccess — the
     * check is bound to THIS instituteId (never to a client-supplied header or a
     * global authority list, which would allow cross-institute access):
     * 1) root users (platform superadmins) bypass;
     * 2) an ACTIVE ADMIN row in the canonical user_role table for this institute;
     * 3) fallback: legacy staff-table membership in this institute.
     */
    private void assertInstituteAdmin(CustomUserDetails user, String instituteId) {
        if (user == null) {
            throw new VacademyException(HttpStatus.UNAUTHORIZED, "User authentication required");
        }
        if (instituteId == null || instituteId.isBlank()) {
            throw new VacademyException(HttpStatus.BAD_REQUEST, "Institute ID is required");
        }

        if (user.isRootUser()) {
            return;
        }

        if (userRoleRepository.existsByUserIdAndInstituteIdAndRoleName(
                user.getUserId(), instituteId, ROLE_NAME_ADMIN)) {
            return;
        }

        boolean isStaff = instituteRepository.findInstitutesByUserId(user.getUserId())
                .stream()
                .anyMatch(institute -> instituteId.equals(institute.getId()));
        if (!isStaff) {
            throw new VacademyException(HttpStatus.FORBIDDEN,
                    "Access denied: you do not have admin access to institute " + instituteId);
        }
    }
}
