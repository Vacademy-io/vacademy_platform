package vacademy.io.admin_core_service.features.user_subscription.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentOptionDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentOptionFilterDTO;
import vacademy.io.admin_core_service.features.user_subscription.enums.PaymentOptionTag;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentOptionService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/v1/payment-option")
public class PaymentOptionController {
    @Autowired
    private PaymentOptionService paymentOptionService;

    @PostMapping
    public ResponseEntity<Boolean> savePaymentOption(@RequestBody PaymentOptionDTO paymentOptionDTO) {
        return ResponseEntity.ok(paymentOptionService.savePaymentOption(paymentOptionDTO));
    }

    @PostMapping("/get-payment-options")
    public ResponseEntity<List<PaymentOptionDTO>> getPaymentOptions(@RequestBody PaymentOptionFilterDTO paymentOptionFilterDTO, @RequestAttribute("user") CustomUserDetails userDetails) {
        return ResponseEntity.ok(paymentOptionService.getPaymentOptions(paymentOptionFilterDTO,userDetails));
    }

    @PostMapping("/make-default-payment-option")
    public ResponseEntity<String> changeDefaultPaymentOption(String source,
                                                                             String sourceId,
                                                                             String paymentOptionId,
                                                                             @RequestAttribute("user") CustomUserDetails userDetails) {
        return ResponseEntity.ok(paymentOptionService.makeDefaultPaymentOption(paymentOptionId,source,sourceId));
    }

    @DeleteMapping
    public ResponseEntity<String> deletePaymentOptions(@RequestBody List<String> paymentOptionIds, @RequestAttribute("user") CustomUserDetails userDetails) {
        return ResponseEntity.ok(paymentOptionService.deletePaymentOption(paymentOptionIds,userDetails));
    }

    @PutMapping
    public ResponseEntity<PaymentOptionDTO> editPaymentOption(@RequestBody PaymentOptionDTO paymentOptionDTO) {
        return ResponseEntity.ok(paymentOptionService.editPaymentOption(paymentOptionDTO));
    }

    @GetMapping("/default-payment-option")
    public ResponseEntity<PaymentOptionDTO>getDeafultPaymentOptionForSource(@RequestParam String source, @RequestParam String sourceId) {
        return ResponseEntity.ok(paymentOptionService.getPaymentOption(source,sourceId, PaymentOptionTag.DEFAULT.name(),List.of(StatusEnum.ACTIVE.name())).get().mapToPaymentOptionDTO());
    }

}
