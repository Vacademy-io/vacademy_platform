package vacademy.io.admin_core_service.features.user_subscription.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentLogDTO;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentLogService;

@RestController
@RequestMapping("/admin-core-service/open/v1/payment-log")
public class OpenPaymentLogController {
    @Autowired
    private PaymentLogService paymentLogService;

    @GetMapping
    public ResponseEntity<PaymentLogDTO> getPaymentLog(String paymentLogId) {
        return ResponseEntity.ok(paymentLogService.getPaymentLog(paymentLogId));
    }
}
