package vacademy.io.admin_core_service.features.user_subscription.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.user_subscription.dto.coupon.CouponValidateRequestDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.coupon.CouponValidateResponseDTO;
import vacademy.io.admin_core_service.features.user_subscription.service.coupon.CouponValidationService;

/**
 * Public validate endpoint hit by all three learner checkout surfaces.
 * No JWT required (it's an /open/ path) — learners can validate before
 * authenticating during signup-on-checkout flows.
 */
@RestController
@RequestMapping("/admin-core-service/open/v1/coupon")
@RequiredArgsConstructor
public class OpenCouponController {

    private final CouponValidationService couponValidationService;

    @PostMapping("/validate")
    public ResponseEntity<CouponValidateResponseDTO> validate(
            @Valid @RequestBody CouponValidateRequestDTO request) {
        return ResponseEntity.ok(couponValidationService.validate(request));
    }
}
