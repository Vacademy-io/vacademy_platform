package vacademy.io.admin_core_service.features.product_page.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ProductPageCouponValidateResponse {

    private String couponCodeId;
    private String appliedCouponDiscountId;
    private String discountType;
    private Double discountValue;
    private Double maxDiscountValue;
    private boolean valid;
    private String message;
}
