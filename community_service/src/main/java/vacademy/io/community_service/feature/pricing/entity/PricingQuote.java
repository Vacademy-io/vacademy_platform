package vacademy.io.community_service.feature.pricing.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.util.Date;

/** A priced plan, optionally attached to the onboarding lead it was built for. */
@Entity
@Table(name = "pricing_quote", schema = "public")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "id")
public class PricingQuote {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "submission_id")
    private String submissionId;

    @Column(name = "source")
    private String source;

    @Column(name = "status")
    private String status;

    @Column(name = "contact_name")
    private String contactName;

    @Column(name = "contact_email")
    private String contactEmail;

    @Column(name = "contact_phone")
    private String contactPhone;

    @Column(name = "organization_name")
    private String organizationName;

    @Column(name = "currency")
    private String currency;

    @Column(name = "bracket_code")
    private String bracketCode;

    @Column(name = "student_count")
    private int studentCount;

    @Column(name = "billing_cycle")
    private String billingCycle;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "selections")
    private String selections;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "breakdown")
    private String breakdown;

    @Column(name = "recurring_annual")
    private BigDecimal recurringAnnual;

    @Column(name = "cycle_adjustment")
    private BigDecimal cycleAdjustment;

    @Column(name = "one_time_total")
    private BigDecimal oneTimeTotal;

    @Column(name = "subtotal")
    private BigDecimal subtotal;

    @Column(name = "tax_amount")
    private BigDecimal taxAmount;

    @Column(name = "total")
    private BigDecimal total;

    @Column(name = "rate_card_version")
    private String rateCardVersion;

    @Column(name = "notes")
    private String notes;

    @Column(name = "created_by_user_id")
    private String createdByUserId;

    // ---- demo workspace provisioned from this quote ----------------------------
    @Column(name = "provisioned_institute_id")
    private String provisionedInstituteId;

    @Column(name = "provisioned_at")
    private Date provisionedAt;

    @Column(name = "demo_expires_at")
    private Date demoExpiresAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Date createdAt;
}
