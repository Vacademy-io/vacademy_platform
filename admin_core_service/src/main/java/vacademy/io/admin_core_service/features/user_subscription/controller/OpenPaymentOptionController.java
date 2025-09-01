package vacademy.io.admin_core_service.features.user_subscription.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentOptionDTO;
import vacademy.io.admin_core_service.features.user_subscription.enums.PaymentOptionTag;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentOptionService;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/open/v1/payment-option")
public class OpenPaymentOptionController {

    @Autowired
    private PaymentOptionService paymentOptionService;

    @GetMapping("/default-payment-option")
    public ResponseEntity<PaymentOptionDTO> getDeafultPaymentOptionForSource(@RequestParam String source, @RequestParam String sourceId) {
        return ResponseEntity.ok(paymentOptionService.getPaymentOption(source,sourceId, PaymentOptionTag.DEFAULT.name(), List.of(StatusEnum.ACTIVE.name())).get().mapToPaymentOptionDTO());
    }
}
