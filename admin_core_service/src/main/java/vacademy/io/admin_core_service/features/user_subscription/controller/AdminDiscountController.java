package vacademy.io.admin_core_service.features.user_subscription.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.user_subscription.dto.coupon.AdminDiscountPreviewDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.coupon.AdminDiscountPreviewRequestDTO;
import vacademy.io.admin_core_service.features.user_subscription.service.coupon.AdminDiscountService;
import vacademy.io.common.auth.model.CustomUserDetails;

/**
 * Price preview for the admin discount field on the manual-enroll, bulk-assign and
 * invoice forms. Institute ADMIN only.
 */
@RestController
@RequestMapping("/admin-core-service/v1/admin-discounts")
@RequiredArgsConstructor
public class AdminDiscountController {

    private final AdminDiscountService adminDiscountService;
    private final InstituteAccessValidator instituteAccessValidator;

    @PostMapping("/preview")
    public ResponseEntity<AdminDiscountPreviewDTO> preview(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam("instituteId") String instituteId,
            @RequestBody AdminDiscountPreviewRequestDTO request) {
        instituteAccessValidator.requireAdminAccess(user, instituteId);
        return ResponseEntity.ok(adminDiscountService.preview(
                request.getDiscount(), instituteId, request.getPaymentPlanId(), request.getGrossAmount(),
                request.getPackageSessionId(), request.getEnrollInviteId(), request.getLearnerEmail()));
    }
}
