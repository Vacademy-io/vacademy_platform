package vacademy.io.admin_core_service.features.user_subscription.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.persistence.Column;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import vacademy.io.admin_core_service.features.enroll_invite.entity.PackageSessionLearnerInvitationToPaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.AppliedCouponDiscount;

import java.time.LocalDateTime;

@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class UserPlanDTO {
    private String id;

    private String userId;

    private String planId;

    private String planJson; // Storing as JSON string

    private String appliedCouponDiscountId;

    private String appliedCouponDiscountJson; // Storing as JSON string

    private String learnerInvitationToPackageSessionId;

    private String status;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private String jsonPaymentDetails;
}
