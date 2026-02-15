package vacademy.io.admin_core_service.features.user_subscription.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.user_subscription.entity.CouponCode;

import java.util.Date;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CouponCodeResponseDTO {
    private String id;
    private String code;
    private String status;
    private String sourceType;
    private String sourceId;
    private boolean isEmailRestricted;
    private String allowedEmailIds;
    private String tag;
    private Date generationDate;
    private Date redeemStartDate;
    private Date redeemEndDate;
    private Long usageLimit;
    private boolean canBeAdded;
    private String shortUrl;

    public static CouponCodeResponseDTO fromEntity(CouponCode couponCode) {
        return CouponCodeResponseDTO.builder()
                .id(couponCode.getId())
                .code(couponCode.getCode())
                .status(couponCode.getStatus())
                .sourceType(couponCode.getSourceType())
                .sourceId(couponCode.getSourceId())
                .isEmailRestricted(couponCode.isEmailRestricted())
                .allowedEmailIds(couponCode.getAllowedEmailIds())
                .tag(couponCode.getTag())
                .generationDate(couponCode.getGenerationDate())
                .redeemStartDate(couponCode.getRedeemStartDate())
                .redeemEndDate(couponCode.getRedeemEndDate())
                .usageLimit(couponCode.getUsageLimit())
                .canBeAdded(couponCode.isCanBeAdded())
                .shortUrl(couponCode.getShortUrl())
                .build();
    }
}
