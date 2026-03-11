package vacademy.io.admin_core_service.features.fee_management.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.fee_management.dto.StudentFeeAllocationLedgerDTO;
import vacademy.io.admin_core_service.features.fee_management.dto.StudentFeePaymentDTO;
import vacademy.io.admin_core_service.features.fee_management.service.FeeLedgerAllocationService;
import vacademy.io.admin_core_service.features.fee_management.service.FeeTrackingService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/admin-core-service/v1/admin/student-fee")
public class FeeTrackingAdminController {

    @Autowired
    private FeeTrackingService feeTrackingService;

    @Autowired
    private FeeLedgerAllocationService feeLedgerAllocationService;

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

    /**
     * Allocate an offline/admin payment for a user across all their unpaid
     * installments.
     *
     * Input:
     *  - userId (path) - the student whose installments are to be updated
     *  - amount (query param) representing the payment amount
     *
     * Behavior:
     *  - Creates a NEW PaymentLog row with status PAID for this amount
     *  - Allocates that amount across all unpaid student_fee_payment rows (FIFO)
     *  - Creates separate ledger rows per student_fee_payment_id for this payment
     */
    @PostMapping("/{userId}/allocate")
    public ResponseEntity<Void> allocatePaymentForLog(
            @PathVariable("userId") String userId,
            @RequestParam("amount") java.math.BigDecimal amount,
            @RequestAttribute("user") CustomUserDetails user) {
        feeLedgerAllocationService.allocatePaymentForUser(userId, amount);
        return ResponseEntity.noContent().build();
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
