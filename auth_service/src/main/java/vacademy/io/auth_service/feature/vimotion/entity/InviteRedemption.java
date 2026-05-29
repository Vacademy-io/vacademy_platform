package vacademy.io.auth_service.feature.vimotion.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

@Entity
@Table(name = "vimotion_invite_redemption")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InviteRedemption {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false)
    private String id;

    @Column(name = "invite_code_id", nullable = false)
    private String inviteCodeId;

    @Column(name = "email", nullable = false)
    private String email;

    @Column(name = "phone_number", nullable = false)
    private String phoneNumber;

    @Column(name = "user_id")
    private String userId;

    @Column(name = "institute_id")
    private String instituteId;

    @Column(name = "redeemed_at", insertable = false, updatable = false)
    private Date redeemedAt;
}
