package vacademy.io.admin_core_service.features.payments.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.payments.service.PaymentService;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;
import vacademy.io.common.payment.dto.PaymentResponseDTO;

@RestController
@RequestMapping("/admin-core-service/open/payments")
public class PaymentController {
    @Autowired
    private PaymentService paymentService;

    @PostMapping("/pay")
    public ResponseEntity<PaymentResponseDTO> handleDonationPayment(
        @RequestBody PaymentInitiationRequestDTO request,
        @RequestParam String instituteId) {

        try {
            var response = paymentService.handlePayment(request, instituteId);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            PaymentResponseDTO errorResponse = new PaymentResponseDTO();
            errorResponse.setStatus("FAILED");
            errorResponse.setMessage("Error processing donation payment: " + e.getMessage());
            return ResponseEntity.badRequest().body(errorResponse);
        }
    }

}
