package vacademy.io.admin_core_service.features.user_subscription.dto.coupon;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Validate response. Field shape matches the existing
 * ProductPageCouponValidateResponse so FE clients can converge on a single
 * shape across the legacy and new endpoints.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CouponValidateResponseDTO {

    private String couponCodeId;
    private String appliedCouponDiscountId;
    private String discountType;
    private Double discountValue;
    private Double maxDiscountValue;
    private boolean valid;

    /** Stable error code; FE maps to learner-facing copy. */
    private String message;
}
