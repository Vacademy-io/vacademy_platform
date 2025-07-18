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
@Table(name = "enroll_invite_discount_option")
public class EnrollInviteDiscountOption {
    @Id
    @UuidGenerator
    private String id;

    @ManyToOne
    @JoinColumn(name = "package_session_learner_invitation_to_payment_option_id")
    private PackageSessionLearnerInvitationToPaymentOption packageSessionLearnerInvitationToPaymentOption;

    @ManyToOne
    @JoinColumn(name = "discount_id")
    private AppliedCouponDiscount discount; // Represents the 'discount' from the original entity

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    @Column(name = "status")
    private String status;

    public EnrollInviteDiscountOption(PackageSessionLearnerInvitationToPaymentOption packageSessionLearnerInvitationToPaymentOption,
                                      AppliedCouponDiscount discount,
                                      String status) {
        this.packageSessionLearnerInvitationToPaymentOption = packageSessionLearnerInvitationToPaymentOption;
        this.discount = discount;
        this.status = status;
    }

}