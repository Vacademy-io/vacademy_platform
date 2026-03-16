package vacademy.io.admin_core_service.features.hr_approval.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.hr_approval.dto.ApprovalActionInputDTO;
import vacademy.io.admin_core_service.features.hr_approval.dto.ApprovalChainDTO;
import vacademy.io.admin_core_service.features.hr_approval.dto.ApprovalRequestDTO;
import vacademy.io.admin_core_service.features.hr_approval.service.ApprovalService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/api/v1/hr/approvals")
public class ApprovalController {

    @Autowired
    private ApprovalService approvalService;

    @Autowired
    private InstituteAccessValidator instituteAccessValidator;

    // ======================== Approval Chains ========================

    @PostMapping("/chains")
    public ResponseEntity<String> saveChain(
            @RequestBody ApprovalChainDTO dto,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        String id = approvalService.saveChain(dto);
        return ResponseEntity.ok(id);
    }

    @GetMapping("/chains")
    public ResponseEntity<List<ApprovalChainDTO>> getChains(
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        List<ApprovalChainDTO> chains = approvalService.getChains(instituteId);
        return ResponseEntity.ok(chains);
    }

    // ======================== Approval Requests ========================

    @PostMapping("/requests")
    public ResponseEntity<String> createRequest(
            @RequestBody ApprovalRequestDTO dto,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, dto.getInstituteId());
        String id = approvalService.createRequest(dto.getInstituteId(), dto.getEntityType(),
                dto.getEntityId(), user.getUserId());
        return ResponseEntity.ok(id);
    }

    @GetMapping("/pending")
    public ResponseEntity<List<ApprovalRequestDTO>> getPendingRequests(
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        List<ApprovalRequestDTO> requests = approvalService.getPendingRequests(instituteId);
        return ResponseEntity.ok(requests);
    }

    @PostMapping("/{id}/action")
    public ResponseEntity<String> processAction(
            @PathVariable("id") String id,
            @RequestBody ApprovalActionInputDTO actionInputDTO,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        String resultId = approvalService.processAction(id, actionInputDTO, user.getUserId());
        return ResponseEntity.ok(resultId);
    }

    @GetMapping("/history")
    public ResponseEntity<ApprovalRequestDTO> getRequestHistory(
            @RequestParam("entityType") String entityType,
            @RequestParam("entityId") String entityId,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        ApprovalRequestDTO request = approvalService.getRequestHistory(entityType, entityId);
        return ResponseEntity.ok(request);
    }
}
