package vacademy.io.admin_core_service.features.user_subscription.dto;

import java.time.LocalDateTime;
import java.util.Date;

public interface PaymentLogWithUserPlanProjection {

    // PaymentLog fields
    String getId();

    String getStatus();

    String getPaymentStatus();

    String getUserId();

    String getVendor();

    String getVendorId();

    Date getDate();

    String getCurrency();

    Double getPaymentAmount();

    LocalDateTime getCreatedAt();

    LocalDateTime getUpdatedAt();

    // UserPlan fields
    String getUserPlanId();

    String getUserPlanUserId();

    String getUserPlanPaymentPlanId();

    String getUserPlanPlanJson();

    String getUserPlanAppliedCouponDiscountId();

    String getUserPlanAppliedCouponDiscountJson();

    String getUserPlanEnrollInviteId();

    String getUserPlanPaymentOptionId();

    String getUserPlanPaymentOptionJson();

    String getUserPlanStatus();

    LocalDateTime getUserPlanCreatedAt();

    LocalDateTime getUserPlanUpdatedAt();

    // Calculated field
    String getCurrentPaymentStatus();
}