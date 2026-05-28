package vacademy.io.admin_core_service.features.user_subscription.dto.coupon;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;
import java.util.Date;
import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CouponDetailResponseDTO {

    private String id;
    private String code;
    private String status;
    private String sourceType;
    private String sourceId;
    private String instituteId;
    private Date redeemStartDate;
    private Date redeemEndDate;
    private Long usageLimit;
    private long usageCount;
    private boolean emailRestricted;
    private String allowedEmailIds;
    private List<String> applicablePackageSessionIds;
    private List<String> applicableEnrollInviteIds;
    private AppliedDiscountInputDTO appliedDiscount;
    private Timestamp createdAt;
    private Timestamp updatedAt;
}
