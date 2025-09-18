package vacademy.io.admin_core_service.features.user_subscription.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDateTime;

@Entity
@Table(name = "referral_benefit_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReferralBenefitLogs {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(name = "id", nullable = false, updatable = false)
    private String id;

    // Relationship with UserPlan (Many logs can belong to one plan)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_plan_id", nullable = false)
    private UserPlan userPlan;

   @ManyToOne(fetch = FetchType.LAZY)
   @JoinColumn(name = "referral_mapping_id", nullable = false)
   private ReferralMapping referralMapping;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "benefit_type", nullable = false)
    private String benefitType; // Example: "DISCOUNT", "CREDIT", etc.

    @Column(name = "beneficiary")
    private String beneficiary;

    @Column(name = "benefit_value", nullable = false)
    private String benefitValue; // e.g., discount %, credits, etc.

    @Column(name = "status", nullable = false)
    private String status; // e.g., "APPLIED", "PENDING", "EXPIRED"

    @Column(name = "created_at", insertable = false, updatable = false, columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false, columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime updatedAt;
}
