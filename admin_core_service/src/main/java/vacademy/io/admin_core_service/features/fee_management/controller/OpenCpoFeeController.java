package vacademy.io.admin_core_service.features.fee_management.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.fee_management.dto.ComplexPaymentOptionDTO;
import vacademy.io.admin_core_service.features.fee_management.dto.OpenCpoPayInstallmentsRequestDTO;
import vacademy.io.admin_core_service.features.fee_management.dto.StudentFeePaymentDTO;
import vacademy.io.admin_core_service.features.fee_management.service.OpenCpoFeeService;
import vacademy.io.common.payment.dto.PaymentResponseDTO;

import java.util.List;

/**
 * Open (no-JWT) endpoints that allow an unauthenticated learner to view their
 * CPO installment schedule and initiate payment for selected installments.
 *
 * <p>Security note: these endpoints live under {@code /open/} and are excluded
 * from JWT filter by {@code ApplicationSecurityConfig}. Caller identity is
 * established by the {@code userId} + {@code userPlanId} pair supplied in the
 * request, and the service validates ownership before performing any operation.</p>
 */
@RestController
@RequestMapping("/admin-core-service/open/v1/fee")
public class OpenCpoFeeController {

    @Autowired
    private OpenCpoFeeService openCpoFeeService;

    /**
     * Returns the full installment schedule for a UserPlan.
     *
     * @param userId     the learner's user ID (returned in the enrollment response as {@code user_plan_id})
     * @param userPlanId the UserPlan ID (returned in the enrollment response as {@code user_plan_id})
     * @return list of {@link StudentFeePaymentDTO} for all installments in the plan
     */
    @GetMapping("/cpo-dues")
    public ResponseEntity<List<StudentFeePaymentDTO>> getCpoDues(
            @RequestParam("userId") String userId,
            @RequestParam("userPlanId") String userPlanId) {
        return ResponseEntity.ok(openCpoFeeService.getCpoDues(userId, userPlanId));
    }

    /**
     * Initiates a gateway payment for one or more selected CPO installments.
     *
     * <p>The caller picks the {@code studentFeePaymentIds} they want to pay (from the
     * list returned by {@code GET /cpo-dues}), optionally sets a {@code customAmount},
     * and provides {@code paymentInitiationRequest} details (email, vendor, etc.).</p>
     *
     * @param request the pay-installments request including userId, userPlanId, and SFP ids
     * @return {@link PaymentResponseDTO} from the configured payment gateway
     */
    @PostMapping("/cpo-pay-installments")
    public ResponseEntity<PaymentResponseDTO> payInstallments(
            @RequestBody OpenCpoPayInstallmentsRequestDTO request) {
        return ResponseEntity.ok(openCpoFeeService.payInstallments(request));
    }

    /**
     * Returns the full CPO installment schedule for a given payment option.
     * Used by the learner BEFORE enrollment so they can see and select which
     * installments they want to pay at enrollment time.
     *
     * @param paymentOptionId the PaymentOption ID from the invite/product-page mapping
     * @return full {@link ComplexPaymentOptionDTO} with all fee types and installments
     */
    @GetMapping("/cpo-schedule")
    public ResponseEntity<ComplexPaymentOptionDTO> getCpoSchedule(
            @RequestParam("paymentOptionId") String paymentOptionId) {
        return ResponseEntity.ok(openCpoFeeService.getCpoSchedule(paymentOptionId));
    }
}
