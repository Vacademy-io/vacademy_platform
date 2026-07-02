package vacademy.io.admin_core_service.features.suborg.registration.controller;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.suborg.registration.dto.CreateRegistrationTemplateDTO;
import vacademy.io.admin_core_service.features.suborg.registration.dto.SubOrgRegistrationFlowDTOs.RegistrationListItemDTO;
import vacademy.io.admin_core_service.features.suborg.registration.dto.SubOrgRegistrationFlowDTOs.TemplateListItemDTO;
import vacademy.io.admin_core_service.features.suborg.registration.service.SubOrgRegistrationTemplateService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;
import java.util.Map;

/** Admin-side management of open sub-org registration templates. */
@RestController
@RequestMapping("/admin-core-service/institute/v1/sub-org-registration")
@RequiredArgsConstructor
@Tag(name = "Sub-Org Registration Templates", description = "Create/list open self-registration links")
public class SubOrgRegistrationAdminController {

    private final SubOrgRegistrationTemplateService templateService;

    @PostMapping("/template/create")
    public ResponseEntity<Map<String, Object>> createTemplate(
            @RequestBody CreateRegistrationTemplateDTO request,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute(value = "user", required = false) CustomUserDetails user) {
        return ResponseEntity.ok(templateService.createTemplate(request, instituteId));
    }

    @GetMapping("/template/list")
    public ResponseEntity<List<TemplateListItemDTO>> listTemplates(
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute(value = "user", required = false) CustomUserDetails user) {
        return ResponseEntity.ok(templateService.listTemplates(instituteId));
    }

    @PatchMapping("/template/{templateId}/status")
    public ResponseEntity<Map<String, Object>> updateStatus(
            @PathVariable("templateId") String templateId,
            @RequestParam("status") String status,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute(value = "user", required = false) CustomUserDetails user) {
        return ResponseEntity.ok(templateService.updateStatus(templateId, status, instituteId));
    }

    @GetMapping("/registrations")
    public ResponseEntity<List<RegistrationListItemDTO>> listRegistrations(
            @RequestParam("templateInviteId") String templateInviteId,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute(value = "user", required = false) CustomUserDetails user) {
        return ResponseEntity.ok(templateService.listRegistrations(templateInviteId, instituteId));
    }
}
