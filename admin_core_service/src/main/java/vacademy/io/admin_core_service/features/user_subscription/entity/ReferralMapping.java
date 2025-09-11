package vacademy.io.admin_core_service.features.user_subscription.entity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDateTime;

@Entity
@Table(name = "referral_mapping")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReferralMapping {

    @Id
    @UuidGenerator
    @Column(length = 255)
    private String id;

    @Column(name = "referrer_user_id", nullable = false, length = 255)
    private String referrerUserId;

    @Column(name = "referee_user_id", nullable = false, length = 255)
    private String refereeUserId;

    @Column(name = "referral_code", nullable = false, length = 255)
    private String referralCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_plan_id", foreignKey = @ForeignKey(name = "fk_referral_mapping_user_plan"))
    private UserPlan userPlan;

    @Column(length = 50)
    private String status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "referral_option_id", foreignKey = @ForeignKey(name = "fk_referral_mapping_referral_option"))
    private ReferralOption referralOption;

    @Column(name = "created_at", updatable = false, insertable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false)
    private LocalDateTime updatedAt;
}
