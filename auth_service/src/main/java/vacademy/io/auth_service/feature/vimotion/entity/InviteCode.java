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
@Table(name = "vimotion_invite_code")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InviteCode {

    public static final String KIND_LOCKED = "locked";
    public static final String KIND_OPEN = "open";

    public static final String STATUS_ACTIVE = "active";
    public static final String STATUS_REVOKED = "revoked";
    public static final String STATUS_EXHAUSTED = "exhausted";

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false)
    private String id;

    @Column(name = "code", nullable = false, unique = true)
    private String code;

    @Column(name = "kind", nullable = false)
    private String kind;

    @Column(name = "status", nullable = false)
    private String status;

    @Column(name = "locked_email")
    private String lockedEmail;

    @Column(name = "locked_phone_number")
    private String lockedPhoneNumber;

    @Column(name = "waitlist_id")
    private String waitlistId;

    @Column(name = "max_uses")
    private Integer maxUses;

    @Column(name = "used_count", nullable = false)
    private Integer usedCount;

    @Column(name = "expires_at")
    private Date expiresAt;

    @Column(name = "note", columnDefinition = "text")
    private String note;

    @Column(name = "created_by")
    private String createdBy;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;
}
