package vacademy.io.admin_core_service.features.product_page.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.enroll_invite.entity.PackageSessionLearnerInvitationToPaymentOption;

import java.time.LocalDateTime;

/**
 * Links one (package-session + invite + payment-option) bridge row to a ProductPage,
 * and locks a specific PaymentPlan for use in the combined-payment total.
 *
 * Why ps_invite_payment_option_id instead of separate enroll_invite_id + package_session_id:
 *   One EnrollInvite can cover multiple package sessions, and one PaymentOption has multiple
 *   PaymentPlans. The bridge FK pins exactly which session/option this row represents;
 *   payment_plan_id pins which price plan is used for the combined checkout total.
 */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Entity
@Table(name = "product_page_invite_mapping")
public class ProductPageInviteMapping {

    @Id
    @UuidGenerator
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_page_id", nullable = false)
    private ProductPage productPage;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ps_invite_payment_option_id", nullable = false)
    private PackageSessionLearnerInvitationToPaymentOption psInvitePaymentOption;

    /** Pre-locked PaymentPlan id — determines the price shown in the cart. */
    @Column(name = "payment_plan_id", nullable = false)
    private String paymentPlanId;

    @Column(name = "is_preselected", nullable = false)
    private boolean preselected;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;

    @Column(name = "status", nullable = false)
    private String status;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;
}
