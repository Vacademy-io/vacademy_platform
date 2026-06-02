package vacademy.io.admin_core_service.features.user_subscription.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Entity
@Table(name = "coupon_enroll_invite")
public class CouponEnrollInvite {

    @Id
    @UuidGenerator
    private String id;

    @Column(name = "coupon_code_id", nullable = false)
    private String couponCodeId;

    @Column(name = "enroll_invite_id", nullable = false)
    private String enrollInviteId;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;
}
