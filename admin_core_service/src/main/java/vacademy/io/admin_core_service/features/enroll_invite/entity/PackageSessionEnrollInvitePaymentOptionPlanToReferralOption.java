package vacademy.io.admin_core_service.features.enroll_invite.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.annotations.Where;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralOption;

import java.util.Date;

@Entity
@Table(name = "package_session_enroll_invite_payment_plan_to_referral_option")
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class PackageSessionEnrollInvitePaymentOptionPlanToReferralOption {

    @Id
    @UuidGenerator
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "payment_plan_id", nullable = false)
    private PaymentPlan paymentPlan;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "referral_option_id", nullable = false)
    private ReferralOption referralOption;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "package_session_invite_payment_option_id", nullable = false)
    private PackageSessionLearnerInvitationToPaymentOption packageSessionLearnerInvitationToPaymentOption;

    @Column(name = "status", nullable = false)
    @Where(clause = "status = 'ACTIVE'")
    private String status;

    @CreationTimestamp
    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "created_at", updatable = false)
    private Date createdAt;

    @UpdateTimestamp
    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "updated_at")
    private Date updatedAt;

    public PackageSessionEnrollInvitePaymentOptionPlanToReferralOption(
            PackageSessionLearnerInvitationToPaymentOption packageSessionLearnerInvitationToPaymentOption,
            ReferralOption referralOption,
            PaymentPlan paymentPlan,
            String status) {
        this.packageSessionLearnerInvitationToPaymentOption = packageSessionLearnerInvitationToPaymentOption;
        this.referralOption = referralOption;
        this.paymentPlan = paymentPlan;
        this.status = status;
    }
}
