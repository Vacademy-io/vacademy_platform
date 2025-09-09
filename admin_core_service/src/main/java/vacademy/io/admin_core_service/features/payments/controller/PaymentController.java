package vacademy.io.admin_core_service.features.payments.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.payments.service.PaymentService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;
import vacademy.io.common.payment.dto.PaymentResponseDTO;

@RestController
@RequestMapping("/admin-core-service/payments/user-plan")
public class PaymentController {

    @Autowired
    private PaymentService paymentService;

    @PostMapping("/user-plan-payment")
    public ResponseEntity<PaymentResponseDTO> handleUserPlanPayment(
        @RequestBody PaymentInitiationRequestDTO request,
        @RequestParam String instituteId,
        @RequestAttribute("user")CustomUserDetails userDetails,
        @RequestParam String userPlanId) {

        try {
            var response = paymentService.handleUserPlanPayment(request, instituteId, userDetails, userPlanId);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            PaymentResponseDTO errorResponse = new PaymentResponseDTO();
            errorResponse.setStatus("FAILED");
            errorResponse.setMessage("Error processing user plan payment: " + e.getMessage());
            return ResponseEntity.badRequest().body(errorResponse);
        }
    }
}
