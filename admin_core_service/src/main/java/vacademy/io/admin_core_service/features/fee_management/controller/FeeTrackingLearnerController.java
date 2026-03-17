package vacademy.io.admin_core_service.features.fee_management.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.fee_management.dto.StudentFeeAllocationLedgerDTO;
import vacademy.io.admin_core_service.features.fee_management.dto.StudentFeePaymentDTO;
import vacademy.io.admin_core_service.features.fee_management.service.FeeTrackingService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/learner/v1/fee")
public class FeeTrackingLearnerController {

    @Autowired
    private FeeTrackingService feeTrackingService;

    @GetMapping("/my-dues")
    public ResponseEntity<List<StudentFeePaymentDTO>> getMyDues(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam("instituteId") String instituteId) {
        return ResponseEntity.ok(feeTrackingService.getStudentDues(user.getUserId(), instituteId));
    }

    @GetMapping("/my-receipts")
    public ResponseEntity<List<StudentFeeAllocationLedgerDTO>> getMyReceipts(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam("instituteId") String instituteId) {
        return ResponseEntity.ok(feeTrackingService.getStudentReceipts(user.getUserId(), instituteId));
    }
}
