package vacademy.io.admin_core_service.features.enroll_invite.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor; // Added for consistency
import lombok.Getter; // Added for consistency
import lombok.NoArgsConstructor; // Added for consistency
import lombok.Setter; // Added for consistency
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.enroll_invite.dto.PackageSessionToPaymentOptionDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption; // Import PaymentOption
import vacademy.io.common.institute.entity.session.PackageSession; // Import PackageSession

import java.time.LocalDateTime;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Entity
@Table(name = "package_session_learner_invitation_to_payment_option")
public class PackageSessionLearnerInvitationToPaymentOption {

    @Id
    @UuidGenerator
    private String id;

    @ManyToOne
    @JoinColumn(name = "enroll_invite_id")
    private EnrollInvite enrollInvite; // Changed from String to Entity

    @ManyToOne
    @JoinColumn(name = "package_session_id")
    private PackageSession packageSession; // Changed from String to Entity

    @ManyToOne
    @JoinColumn(name = "payment_option_id")
    private PaymentOption paymentOption; // Changed from String to Entity

    @Column(name = "status")
    private String status;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    public PackageSessionLearnerInvitationToPaymentOption(EnrollInvite enrollInvite, PackageSession packageSession,
            PaymentOption paymentOption, String status) {
        this.enrollInvite = enrollInvite;
        this.packageSession = packageSession;
        this.paymentOption = paymentOption;
        this.status = status;
    }

    public PackageSessionToPaymentOptionDTO mapToPackageSessionToPaymentOptionDTO() {
        return PackageSessionToPaymentOptionDTO.builder()
                .id(this.id)
                .packageSessionId(this.packageSession.getId())
                .enrollInviteId(this.enrollInvite.getId())
                .status(this.status)
                .paymentOption(this.paymentOption.mapToPaymentOptionDTO())
                .build();
    }
}