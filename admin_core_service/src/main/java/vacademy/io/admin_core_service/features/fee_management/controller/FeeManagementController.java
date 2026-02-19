package vacademy.io.admin_core_service.features.fee_management.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.fee_management.dto.ComplexPaymentOptionDTO;
import vacademy.io.admin_core_service.features.fee_management.service.FeeManagementService;
import vacademy.io.common.auth.model.CustomUserDetails;

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
    public ResponseEntity<Page<ComplexPaymentOptionDTO>> listCposByInstitute(
            @PathVariable String instituteId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        return ResponseEntity.ok(feeManagementService.listCposByInstitute(instituteId, page, size));
    }

    /**
     * API #3: Get full CPO with all nested children.
     * GET /admin-core-service/v1/fee-management/cpo/{cpoId}/full
     */
    @GetMapping("/cpo/{cpoId}/full")
    public ResponseEntity<ComplexPaymentOptionDTO> getFullCpo(
            @PathVariable String cpoId,
            @RequestParam(defaultValue = "0") int feeTypePage,
            @RequestParam(defaultValue = "20") int feeTypeSize,
            @RequestParam(defaultValue = "0") int installmentPage,
            @RequestParam(defaultValue = "50") int installmentSize,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        return ResponseEntity.ok(
                feeManagementService.getFullCpo(cpoId, feeTypePage, feeTypeSize, installmentPage, installmentSize));
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
    @PutMapping("/cpo/{cpoId}/soft-delete-shivamapi")
    public ResponseEntity<ComplexPaymentOptionDTO> softDeleteCpo(
            @PathVariable String cpoId,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        return ResponseEntity.ok(feeManagementService.softDeleteCpoById(cpoId));
    }
}
