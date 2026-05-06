package vacademy.io.admin_core_service.features.enroll_invite.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.enroll_invite.dto.PackageSessionToPaymentOptionDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.time.LocalDateTime;

/**
 * Bridge between an EnrollInvite, a PackageSession, and a PaymentOption.
 *
 * After the CPO unification (V224), CPO-backed enrollments are represented by
 * pointing this bridge's {@code paymentOption} at a PaymentOption row whose
 * {@code type='CPO'} and whose {@code complexPaymentOptionId} points at the
 * underlying ComplexPaymentOption. The previous {@code cpo_id} column on this
 * bridge was redundant and has been dropped.
 */
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
    private EnrollInvite enrollInvite;

    @ManyToOne
    @JoinColumn(name = "package_session_id")
    private PackageSession packageSession;

    @ManyToOne
    @JoinColumn(name = "payment_option_id")
    private PaymentOption paymentOption;

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

    /**
     * Convenience accessor: when this bridge's paymentOption is a CPO mirror,
     * returns the underlying CPO id; otherwise null.
     */
    public String getCpoId() {
        return paymentOption != null ? paymentOption.getComplexPaymentOptionId() : null;
    }

    public PackageSessionToPaymentOptionDTO mapToPackageSessionToPaymentOptionDTO() {
        return PackageSessionToPaymentOptionDTO.builder()
                .id(this.id)
                .packageSessionId(this.packageSession.getId())
                .enrollInviteId(this.enrollInvite.getId())
                .status(this.status)
                .paymentOption(this.paymentOption != null ? this.paymentOption.mapToPaymentOptionDTO() : null)
                .cpoId(getCpoId())
                .build();
    }
}
