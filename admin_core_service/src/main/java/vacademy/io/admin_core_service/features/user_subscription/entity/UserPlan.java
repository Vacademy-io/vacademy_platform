package vacademy.io.admin_core_service.features.user_subscription.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.enroll_invite.entity.PackageSessionLearnerInvitationToPaymentOption;

import java.time.LocalDateTime;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Entity
@Table(name = "user_plan")
public class UserPlan {
    @Id
    @UuidGenerator
    private String id;

    @Column(name = "user_id")
    private String userId;

    @Column(name = "plan_id")
    private String planId;

    @Column(name = "plan_json", columnDefinition = "TEXT")
    private String planJson; // Storing as JSON string

    @ManyToOne
    @JoinColumn(name = "applied_coupon_discount_id")
    private AppliedCouponDiscount appliedCouponDiscount;

    @Column(name = "applied_coupon_discount_json", columnDefinition = "TEXT")
    private String appliedCouponDiscountJson; // Storing as JSON string

    @ManyToOne
    @JoinColumn(name = "package_session_learner_invitation_to_payment_option_id")
    private PackageSessionLearnerInvitationToPaymentOption packageSessionLearnerInvitationToPaymentOption;

    @Column(name = "status")
    private String status;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;
}