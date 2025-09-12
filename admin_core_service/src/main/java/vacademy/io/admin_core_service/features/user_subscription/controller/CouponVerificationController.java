package vacademy.io.admin_core_service.features.user_subscription.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.user_subscription.dto.CouponVerificationRequestDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.CouponVerificationResponseDTO;
import vacademy.io.admin_core_service.features.user_subscription.service.ReferralOptionService;

@RestController
@RequestMapping("/admin-core-service/open/v1/user-subscription")
public class CouponVerificationController {

    @Autowired
    private ReferralOptionService referralOptionService;

    @PostMapping("/verify")
    public ResponseEntity<CouponVerificationResponseDTO> verifyCouponCode(
        @RequestParam String couponCode,
        @RequestParam String referralOptionId,
        @RequestBody CouponVerificationRequestDTO request) {

        CouponVerificationResponseDTO response = referralOptionService.verifyCouponCode(
            couponCode,
            referralOptionId,
            request
        );

        return ResponseEntity.ok(response);
    }
}
