package vacademy.io.admin_core_service.features.user_subscription.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;

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

    // Foreign key + lazy mapping for PaymentPlan
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plan_id", insertable = false, updatable = false)
    private PaymentPlan paymentPlan;

    @Column(name = "plan_id")
    private String paymentPlanId;

    @Column(name = "plan_json", columnDefinition = "TEXT")
    private String planJson;

    @Column(name = "applied_coupon_discount_id")
    private String appliedCouponDiscountId;

    @Column(name = "applied_coupon_discount_json", columnDefinition = "TEXT")
    private String appliedCouponDiscountJson;

    // Assuming you want to map coupon discount entity (optional)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "applied_coupon_discount_id", insertable = false, updatable = false)
    private AppliedCouponDiscount appliedCouponDiscount;

    @Column(name = "enroll_invite_id")
    private String enrollInviteId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "enroll_invite_id", insertable = false, updatable = false)
    private EnrollInvite enrollInvite;

    @Column(name = "payment_option_id")
    private String paymentOptionId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "payment_option_id", insertable = false, updatable = false)
    private PaymentOption paymentOption;

    @Column(name = "payment_option_json", columnDefinition = "TEXT")
    private String paymentOptionJson;

    @Column(name = "status")
    private String status;

    @Column(name = "json_payment_details", columnDefinition = "TEXT")
    private String jsonPaymentDetails;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;
}
