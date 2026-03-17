package vacademy.io.admin_core_service.features.user_subscription.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.user_subscription.dto.CouponCodeResponseDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.CouponCode;
import vacademy.io.admin_core_service.features.user_subscription.enums.CouponSourceType;
import vacademy.io.admin_core_service.features.user_subscription.service.CouponCodeService;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/admin-core-service/coupon/v1")
public class CouponCodeController {

    @Autowired
    private CouponCodeService couponCodeService;

    @Autowired
    private vacademy.io.admin_core_service.features.shortlink.service.ShortUrlManagementService shortUrlManagementService;

    /**
     * Get coupon codes by source ID and source type
     * @param sourceId The source ID to search for
     * @param sourceType The source type to search for
     * @return List of matching coupon codes
     */
    @GetMapping("/by-source")
    public ResponseEntity<List<CouponCodeResponseDTO>> getCouponCodesBySource(
            @RequestParam String sourceId,
            @RequestParam String sourceType,
            @RequestHeader(value = "x-institute-id", required = false) String instituteId) {

        List<CouponCode> couponCodes = couponCodeService.getCouponCodesBySource(sourceId, sourceType);
        List<CouponCodeResponseDTO> responseDTOs = couponCodes.stream()
                .map(c -> {
                    String shortCode = couponCodeService.getOrGenerateShortUrl(c, instituteId);
                    CouponCodeResponseDTO dto = CouponCodeResponseDTO.fromEntity(c);
                    dto.setShortReferralLink(
                            shortUrlManagementService.getAbsoluteShortUrl(instituteId, shortCode));
                    return dto;
                })
                .collect(Collectors.toList());
        
        return ResponseEntity.ok(responseDTOs);
    }


    /**
     * Get coupon code by actual code string
     * @param code The coupon code string
     * @return The matching coupon code
     */
    @GetMapping("/by-code")
    public ResponseEntity<CouponCodeResponseDTO> getCouponCodeByCode(
            @RequestParam String code,
            @RequestHeader(value = "x-institute-id", required = false) String instituteId) {
        Optional<CouponCode> couponCode = couponCodeService.getCouponCodeByCode(code);
        
        if (couponCode.isPresent()) {
            CouponCode c = couponCode.get();
            String shortCode = couponCodeService.getOrGenerateShortUrl(c, instituteId);
            CouponCodeResponseDTO dto = CouponCodeResponseDTO.fromEntity(c);
            dto.setShortReferralLink(
                    shortUrlManagementService.getAbsoluteShortUrl(instituteId, shortCode));
            return ResponseEntity.ok(dto);
        } else {
            return ResponseEntity.notFound().build();
        }
    }


    /**
     * Get coupon code by source ID (for USER source type)
     * @param sourceId The source ID (user ID)
     * @return The coupon code for the user
     */
    @GetMapping("/by-source-id")
    public ResponseEntity<CouponCodeResponseDTO> getCouponCodeBySourceId(
            @RequestParam String sourceId,
            @RequestHeader(value = "x-institute-id", required = false) String instituteId) {
        Optional<CouponCode> couponCode = couponCodeService.getCouponCodeBySource(sourceId, CouponSourceType.USER);

        if (couponCode.isPresent()) {
            CouponCode c = couponCode.get();
            String shortCode = couponCodeService.getOrGenerateShortUrl(c, instituteId);
            CouponCodeResponseDTO dto = CouponCodeResponseDTO.fromEntity(c);
            dto.setShortReferralLink(
                    shortUrlManagementService.getAbsoluteShortUrl(instituteId, shortCode));
            return ResponseEntity.ok(dto);
        } else {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Update coupon code status
     * @param code The coupon code string
     * @param status The new status
     * @return Updated coupon code
     */
    @PutMapping("/update-status")
    public ResponseEntity<CouponCodeResponseDTO> updateCouponCodeStatus(
            @RequestParam String code,
            @RequestParam String status,
            @RequestHeader(value = "x-institute-id", required = false) String instituteId) {

        Optional<CouponCode> couponCodeOpt = couponCodeService.getCouponCodeByCode(code);
        
        if (couponCodeOpt.isPresent()) {
            CouponCode updatedCouponCode = couponCodeService.updateCouponCodeStatus(couponCodeOpt.get(), status);
            String shortCode = couponCodeService.getOrGenerateShortUrl(updatedCouponCode, instituteId);
            CouponCodeResponseDTO dto = CouponCodeResponseDTO.fromEntity(updatedCouponCode);
            dto.setShortReferralLink(
                    shortUrlManagementService.getAbsoluteShortUrl(instituteId, shortCode));
            return ResponseEntity.ok(dto);
        } else {
            return ResponseEntity.notFound().build();
        }
    }
}
