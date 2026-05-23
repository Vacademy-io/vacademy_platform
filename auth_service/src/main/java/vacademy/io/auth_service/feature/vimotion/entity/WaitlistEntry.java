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
@Table(name = "vimotion_waitlist")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WaitlistEntry {

    public static final String STATUS_PENDING = "pending";
    public static final String STATUS_INVITED = "invited";
    public static final String STATUS_CONVERTED = "converted";
    public static final String STATUS_REJECTED = "rejected";

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false)
    private String id;

    @Column(name = "full_name", nullable = false)
    private String fullName;

    @Column(name = "email", nullable = false)
    private String email;

    @Column(name = "phone_number", nullable = false)
    private String phoneNumber;

    @Column(name = "status", nullable = false)
    private String status;

    @Column(name = "referrer_id")
    private String referrerId;

    @Column(name = "referral_code", nullable = false, unique = true)
    private String referralCode;

    @Column(name = "referral_count", nullable = false)
    private Integer referralCount;

    @Column(name = "position", nullable = false)
    private Integer position;

    @Column(name = "source")
    private String source;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}
