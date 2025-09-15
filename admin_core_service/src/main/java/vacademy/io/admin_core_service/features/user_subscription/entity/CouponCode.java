package vacademy.io.admin_core_service.features.user_subscription.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp; // Changed from java.sql.Timestamp
import java.util.Date;
import java.util.List;

// You might need a custom AttributeConverter for List<String> to JSONB for robust handling
// For simplicity in the entity definition, I'll represent it as a String if stored as JSONB string,
// or a List<String> if using a custom converter. For direct entity representation,
// a List<String> would require an @ElementCollection or a custom converter.
// Given the SQL table used JSONB, a String mapping for the JSON content is common if you serialize/deserialize it in application logic.
// If you want JPA to handle the List directly, you'd need @Convert or @ElementCollection.
// For now, I'll keep it as String for simplicity to match JSONB column definition.

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Entity
@Table(name = "coupon_code")
public class CouponCode {

    @Id
    @UuidGenerator
    private String id;

    @Column(name = "code", unique = true, nullable = false)
    private String code; // Actual coupon code shown to users

    @Column(name = "status") // e.g., ACTIVE, EXPIRED, REDEEMED
    private String status;

    @Column(name = "source_type") // Where this coupon originated from (e.g., ADMIN, SYSTEM)
    private String sourceType;

    @Column(name = "source_id") // ID of the source entity (e.g., campaign, admin ID)
    private String sourceId;

    @Column(name = "is_email_restricted") // If true, applicable only to listed email IDs
    private boolean isEmailRestricted;

    // Option 1: Store as JSON string in DB
    @Column(name = "allowed_email_ids")
    private String allowedEmailIds;

    @Column(name = "tag")
    private String tag;

    @Column(name = "generation_date")
    private Date generationDate;

    @Column(name = "redeem_start_date")
    private Date redeemStartDate;

    @Column(name = "redeem_end_date")
    private Date redeemEndDate;

    @Column(name = "usage_limit") // Maximum number of times this coupon can be used
    private Long usageLimit;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;

    @Column(name = "can_be_added")
    private boolean canBeAdded;
}
