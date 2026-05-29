package vacademy.io.admin_core_service.features.user_subscription.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.user_subscription.dto.coupon.CouponCreateRequestDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.coupon.CouponDetailResponseDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.coupon.CouponSummaryDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.coupon.CouponUpdateRequestDTO;
import vacademy.io.admin_core_service.features.user_subscription.service.coupon.CouponManagementService;

import java.util.List;

/**
 * Admin CRUD for institute-scoped coupons. Auth: JWT in the filter chain
 * + {@code clientId} request header (auto-injected by the admin dashboard
 * axios interceptor). The service verifies the requested coupon belongs
 * to the header's institute on every mutating call.
 */
@RestController
@RequestMapping("/admin-core-service/v1/coupon")
@RequiredArgsConstructor
public class CouponManagementController {

    private final CouponManagementService couponManagementService;

    @PostMapping
    public ResponseEntity<CouponDetailResponseDTO> create(
            @RequestHeader("clientId") String instituteId,
            @Valid @RequestBody CouponCreateRequestDTO request) {
        return ResponseEntity.ok(couponManagementService.create(instituteId, request));
    }

    @PutMapping("/{couponId}")
    public ResponseEntity<CouponDetailResponseDTO> update(
            @RequestHeader("clientId") String instituteId,
            @PathVariable String couponId,
            @Valid @RequestBody CouponUpdateRequestDTO request) {
        return ResponseEntity.ok(couponManagementService.update(instituteId, couponId, request));
    }

    @GetMapping("/{couponId}")
    public ResponseEntity<CouponDetailResponseDTO> get(
            @RequestHeader("clientId") String instituteId,
            @PathVariable String couponId) {
        return ResponseEntity.ok(couponManagementService.get(instituteId, couponId));
    }

    @GetMapping
    public ResponseEntity<Page<CouponSummaryDTO>> list(
            @RequestHeader("clientId") String instituteId,
            @RequestParam(required = false) List<String> status,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(couponManagementService.list(instituteId, status, search, page, size));
    }

    @DeleteMapping("/{couponId}")
    public ResponseEntity<Void> delete(
            @RequestHeader("clientId") String instituteId,
            @PathVariable String couponId) {
        couponManagementService.softDelete(instituteId, couponId);
        return ResponseEntity.noContent().build();
    }
}
