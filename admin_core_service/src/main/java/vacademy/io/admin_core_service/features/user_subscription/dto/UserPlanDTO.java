package vacademy.io.admin_core_service.features.user_subscription.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Data Transfer Object for UserPlan entity.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserPlanDTO {

    private String id;
    private String userId;

    private String paymentPlanId;
    private String planJson;

    private String appliedCouponDiscountId;
    private String appliedCouponDiscountJson;

    private String enrollInviteId;

    private String paymentOptionId;
    private String paymentOptionJson;

    private String status;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    private List<PaymentLogDTO>paymentLogs;
}
