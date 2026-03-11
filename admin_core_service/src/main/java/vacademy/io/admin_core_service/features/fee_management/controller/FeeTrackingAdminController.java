package vacademy.io.admin_core_service.features.fee_management.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.fee_management.dto.FeeSearchFilterDTO;
import vacademy.io.admin_core_service.features.fee_management.dto.StudentFeeAllocationLedgerDTO;
import vacademy.io.admin_core_service.features.fee_management.dto.StudentFeePaymentDTO;
import vacademy.io.admin_core_service.features.fee_management.dto.StudentFeePaymentRowDTO;
import vacademy.io.admin_core_service.features.fee_management.service.FeeLedgerAllocationService;
import vacademy.io.admin_core_service.features.fee_management.service.FeeTrackingService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/v1/admin/student-fee")
public class FeeTrackingAdminController {

    @Autowired
    private FeeTrackingService feeTrackingService;

    @Autowired
    private FeeLedgerAllocationService feeLedgerAllocationService;

    @GetMapping("/{userId}/dues")
    public ResponseEntity<List<StudentFeePaymentDTO>> getStudentDues(
            @PathVariable("userId") String userId,
            @RequestParam("instituteId") String instituteId) {
        return ResponseEntity.ok(feeTrackingService.getStudentDues(userId, instituteId));
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
     * Admin fee roster search — powers the "Manage Finances" table in the frontend.
     *
     * POST /admin-core-service/v1/admin/student-fee/search?instituteId={instituteId}
     *
     * Accepts a rich filter payload and returns a paginated list of student fee
     * payment records enriched with student name/email and fee type context.
     */
    @PostMapping("/search")
    public ResponseEntity<Page<StudentFeePaymentRowDTO>> searchStudentFeePayments(
            @RequestParam("instituteId") String instituteId,
            @RequestBody FeeSearchFilterDTO filter,
            @RequestAttribute("user") CustomUserDetails user) {
        Page<StudentFeePaymentRowDTO> results = feeTrackingService.searchFeePayments(instituteId, filter);
        return ResponseEntity.ok(results);
    }

}
