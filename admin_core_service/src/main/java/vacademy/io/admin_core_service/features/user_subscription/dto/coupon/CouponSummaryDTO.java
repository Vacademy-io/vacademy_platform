package vacademy.io.admin_core_service.features.user_subscription.dto.coupon;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;
import java.util.Date;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CouponSummaryDTO {

    private String id;
    private String code;
    private String status;
    private String sourceType;
    private Date redeemStartDate;
    private Date redeemEndDate;
    private Long usageLimit;
    private long usageCount;
    private String discountType;
    private Double discountPoint;
    private Double maxDiscountPoint;
    private Timestamp createdAt;
}
