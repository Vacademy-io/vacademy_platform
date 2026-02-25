package vacademy.io.admin_core_service.features.fee_management.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.fee_management.dto.StudentFeeAllocationLedgerDTO;
import vacademy.io.admin_core_service.features.fee_management.dto.StudentFeePaymentDTO;
import vacademy.io.admin_core_service.features.fee_management.service.FeeLedgerAllocationService;
import vacademy.io.admin_core_service.features.fee_management.service.FeeTrackingService;

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
     * Trigger allocation of a captured payment (PaymentLog) across the student's
     * fee installments.
     *
     * This:
     *  - looks up the PaymentLog
     *  - allocates its amount across unpaid StudentFeePayment rows (FIFO by due date)
     *  - updates installment statuses and amounts
     *  - appends entries in student_fee_allocation_ledger
     *  - marks the PaymentLog as PAID
     */
    @PostMapping("/payment-log/{paymentLogId}/allocate")
    public ResponseEntity<Void> allocatePaymentForLog(@PathVariable("paymentLogId") String paymentLogId) {
        feeLedgerAllocationService.allocatePaymentForLog(paymentLogId);
        return ResponseEntity.noContent().build();
    }
}
