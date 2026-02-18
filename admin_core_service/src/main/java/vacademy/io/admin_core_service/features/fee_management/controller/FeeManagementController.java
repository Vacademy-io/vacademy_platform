package vacademy.io.admin_core_service.features.fee_management.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.fee_management.dto.ComplexPaymentOptionDTO;
import vacademy.io.admin_core_service.features.fee_management.service.FeeManagementService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/v1/fee-management")
public class FeeManagementController {

    @Autowired
    private FeeManagementService feeManagementService;

    /**
     * API #1: Create a full CPO with nested fee types, assigned values, and
     * installments.
     * POST /admin-core-service/v1/fee-management/cpo
     */
    @PostMapping("/cpo")
    public ResponseEntity<ComplexPaymentOptionDTO> createCpo(
            @RequestBody ComplexPaymentOptionDTO request,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        return ResponseEntity.ok(feeManagementService.createCpo(request));
    }

    /**
     * API #2: List all CPOs for an institute (lightweight).
     * GET /admin-core-service/v1/fee-management/cpo/{instituteId}
     */
    @GetMapping("/cpo/{instituteId}")
    public ResponseEntity<List<ComplexPaymentOptionDTO>> listCposByInstitute(
            @PathVariable String instituteId,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        return ResponseEntity.ok(feeManagementService.listCposByInstitute(instituteId));
    }

    /**
     * API #3: Get full CPO with all nested children.
     * GET /admin-core-service/v1/fee-management/cpo/{cpoId}/full
     */
    @GetMapping("/cpo/{cpoId}/full")
    public ResponseEntity<ComplexPaymentOptionDTO> getFullCpo(
            @PathVariable String cpoId,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        return ResponseEntity.ok(feeManagementService.getFullCpo(cpoId));
    }

    /**
     * API #4: Update CPO Metadata.
     * PUT /admin-core-service/v1/fee-management/cpo/{cpoId}
     */
    @PutMapping("/cpo/{cpoId}")
    public ResponseEntity<ComplexPaymentOptionDTO> updateCpo(
            @PathVariable String cpoId,
            @RequestBody ComplexPaymentOptionDTO request,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        return ResponseEntity.ok(feeManagementService.updateCpo(cpoId, request));
    }

    /**
     * API #5: Update Fee Type & Commercials.
     * PUT /admin-core-service/v1/fee-management/fee-type/{feeTypeId}
     */
    @PutMapping("/fee-type/{feeTypeId}")
    public ResponseEntity<ComplexPaymentOptionDTO.FeeTypeDTO> updateFeeType(
            @PathVariable String feeTypeId,
            @RequestBody ComplexPaymentOptionDTO.FeeTypeDTO request,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        return ResponseEntity.ok(feeManagementService.updateFeeType(feeTypeId, request));
    }

    /**
     * API #6: Soft delete CPO and all related records by status update.
     * PUT /admin-core-service/v1/fee-management/cpo/{cpoId}/soft-delete
     */
    @PutMapping("/cpo/{cpoId}/soft-delete")
    public ResponseEntity<ComplexPaymentOptionDTO> softDeleteCpo(
            @PathVariable String cpoId,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        return ResponseEntity.ok(feeManagementService.softDeleteCpoById(cpoId));
    }
}
