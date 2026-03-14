package vacademy.io.admin_core_service.features.fee_management.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.fee_management.dto.InstituteFeeTypePriorityDTO;
import vacademy.io.admin_core_service.features.fee_management.dto.InvoiceReceiptDTO;
import vacademy.io.admin_core_service.features.fee_management.dto.SetPriorityRequest;
import vacademy.io.admin_core_service.features.fee_management.dto.StudentFeeAllocationLedgerDTO;
import vacademy.io.admin_core_service.features.fee_management.dto.StudentFeePaymentDTO;
import vacademy.io.admin_core_service.features.fee_management.entity.InstituteFeeTypePriority;
import vacademy.io.admin_core_service.features.fee_management.enums.AllocationScope;
import vacademy.io.admin_core_service.features.fee_management.repository.InstituteFeeTypePriorityRepository;
import vacademy.io.admin_core_service.features.fee_management.service.FeeLedgerAllocationService;
import vacademy.io.admin_core_service.features.fee_management.service.FeeTrackingService;
import vacademy.io.admin_core_service.features.invoice.entity.Invoice;
import vacademy.io.admin_core_service.features.invoice.repository.InvoiceRepository;
import vacademy.io.admin_core_service.features.media_service.service.MediaService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/admin-core-service/v1/admin/student-fee")
public class FeeTrackingAdminController {

    @Autowired
    private FeeTrackingService feeTrackingService;

    @Autowired
    private FeeLedgerAllocationService feeLedgerAllocationService;

    @Autowired
    private InstituteFeeTypePriorityRepository priorityRepository;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private MediaService mediaService;

    @PostMapping("/{userId}/dues")
    public ResponseEntity<List<StudentFeePaymentDTO>> getStudentDues(
            @PathVariable("userId") String userId,
            @RequestParam("instituteId") String instituteId,
            @RequestBody(required = false) DuesFilterRequest filter) {

        List<StudentFeePaymentDTO> dues = feeTrackingService.getStudentDues(userId, instituteId);

        if (filter != null) {
            // Optional status filter (e.g., PENDING, PARTIAL_PAID, OVERDUE)
            if (filter.getStatus() != null && !filter.getStatus().isBlank()) {
                String statusFilter = filter.getStatus().trim().toUpperCase();
                dues = dues.stream()
                        .filter(d -> d.getStatus() != null
                                && d.getStatus().toUpperCase().equals(statusFilter))
                        .collect(Collectors.toList());
            }

            // Optional due date range filter
            LocalDate start = filter.getStartDueDate();
            LocalDate end = filter.getEndDueDate();
            if (start != null || end != null) {
                dues = dues.stream()
                        .filter(d -> {
                            if (d.getDueDate() == null) {
                                return false;
                            }
                            LocalDate due = d.getDueDate().toInstant()
                                    .atZone(ZoneId.systemDefault())
                                    .toLocalDate();
                            if (start != null && due.isBefore(start)) {
                                return false;
                            }
                            if (end != null && due.isAfter(end)) {
                                return false;
                            }
                            return true;
                        })
                        .collect(Collectors.toList());
            }
        }

        return ResponseEntity.ok(dues);
    }

    @GetMapping("/{userId}/receipts")
    public ResponseEntity<List<StudentFeeAllocationLedgerDTO>> getStudentReceipts(
            @PathVariable("userId") String userId,
            @RequestParam("instituteId") String instituteId) {
        return ResponseEntity.ok(feeTrackingService.getStudentReceipts(userId, instituteId));
    }

    @GetMapping("/{userId}/invoice-receipts")
    public ResponseEntity<List<InvoiceReceiptDTO>> getStudentInvoiceReceipts(
            @PathVariable("userId") String userId,
            @RequestParam("instituteId") String instituteId) {
        return ResponseEntity.ok(feeTrackingService.getStudentInvoiceReceipts(userId, instituteId));
    }

    /**
     * Allocate an offline/admin payment for a user across their unpaid installments
     * with overdue-first + institute fee-type priority ordering.
     *
     * @param userId      the student whose installments are to be updated
     * @param amount      the payment amount
     * @param instituteId optional – derived from bills when absent
     * @param scope       OVERDUE_ONLY or ALL_DUES (defaults to ALL_DUES)
     */
    @PostMapping("/{userId}/allocate")
    public ResponseEntity<Void> allocatePaymentForUser(
            @PathVariable("userId") String userId,
            @RequestParam("amount") java.math.BigDecimal amount,
            @RequestParam(value = "instituteId", required = false) String instituteId,
            @RequestParam(value = "scope", required = false, defaultValue = "ALL_DUES") String scope,
            @RequestAttribute("user") CustomUserDetails user) {

        AllocationScope allocationScope;
        try {
            allocationScope = AllocationScope.valueOf(scope.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }

        feeLedgerAllocationService.allocatePaymentForUser(userId, amount, instituteId, allocationScope);
        return ResponseEntity.noContent().build();
    }

    // ---- Fee-type priority configuration endpoints ----

    @PutMapping("/priority")
    @Transactional
    public ResponseEntity<Void> setFeeTypePriority(
            @RequestParam("instituteId") String instituteId,
            @RequestBody SetPriorityRequest request,
            @RequestAttribute("user") CustomUserDetails user) {

        if (request.getScope() == null || request.getPriorities() == null) {
            return ResponseEntity.badRequest().build();
        }

        String scopeStr;
        try {
            scopeStr = AllocationScope.valueOf(request.getScope().trim().toUpperCase()).name();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }

        priorityRepository.deleteByInstituteIdAndScope(instituteId, scopeStr);

        for (InstituteFeeTypePriorityDTO dto : request.getPriorities()) {
            InstituteFeeTypePriority entity = new InstituteFeeTypePriority();
            entity.setInstituteId(instituteId);
            entity.setScope(scopeStr);
            entity.setFeeTypeId(dto.getFeeTypeId());
            entity.setPriorityOrder(dto.getPriorityOrder());
            priorityRepository.save(entity);
        }

        return ResponseEntity.noContent().build();
    }

    @GetMapping("/priority")
    public ResponseEntity<List<InstituteFeeTypePriorityDTO>> getFeeTypePriority(
            @RequestParam("instituteId") String instituteId,
            @RequestParam("scope") String scope) {

        String scopeStr;
        try {
            scopeStr = AllocationScope.valueOf(scope.trim().toUpperCase()).name();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }

        List<InstituteFeeTypePriorityDTO> result = priorityRepository
                .findByInstituteIdAndScopeOrderByPriorityOrderAsc(instituteId, scopeStr)
                .stream()
                .map(e -> InstituteFeeTypePriorityDTO.builder()
                        .feeTypeId(e.getFeeTypeId())
                        .priorityOrder(e.getPriorityOrder())
                        .build())
                .collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    // ---- Receipt PDF Download ----

    /**
     * Get download URL for receipt PDF.
     * Frontend should use the returned URL with &lt;a download&gt; to trigger download.
     *
     * @param invoiceId the invoice/receipt ID
     * @return JSON with download_url, invoice_number, file_name
     */
    @GetMapping("/receipt/{invoiceId}/download")
    public ResponseEntity<?> downloadReceiptPdf(@PathVariable("invoiceId") String invoiceId) {
        Invoice invoice = invoiceRepository.findById(invoiceId).orElse(null);
        if (invoice == null) {
            return ResponseEntity.notFound().build();
        }

        String pdfFileId = invoice.getPdfFileId();
        if (!StringUtils.hasText(pdfFileId)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "PDF not available for this receipt"));
        }

        String signedUrl = mediaService.getFileUrlById(pdfFileId);
        if (!StringUtils.hasText(signedUrl)) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to generate download URL"));
        }

        return ResponseEntity.ok(Map.of(
                "download_url", signedUrl,
                "invoice_number", invoice.getInvoiceNumber(),
                "file_name", "receipt_" + invoice.getInvoiceNumber() + ".pdf"
        ));
    }

    /**
     * Request body for filtering dues.
     * - status: optional status filter (e.g. "PENDING", "PARTIAL_PAID").
     * - startDueDate / endDueDate: optional due date range (yyyy-MM-dd).
     */
    public static class DuesFilterRequest {
        private String status;
        private LocalDate startDueDate;
        private LocalDate endDueDate;

        public String getStatus() {
            return status;
        }

        public void setStatus(String status) {
            this.status = status;
        }

        public LocalDate getStartDueDate() {
            return startDueDate;
        }

        public void setStartDueDate(LocalDate startDueDate) {
            this.startDueDate = startDueDate;
        }

        public LocalDate getEndDueDate() {
            return endDueDate;
        }

        public void setEndDueDate(LocalDate endDueDate) {
            this.endDueDate = endDueDate;
        }
    }

}
