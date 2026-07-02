package vacademy.io.community_service.feature.onboarding.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

import java.util.Date;

/** A completed onboarding form. Promoted columns drive the list view; {@code answers} keeps the full payload. */
@Entity
@Table(name = "onboarding_submission", schema = "public")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "id")
public class OnboardingSubmission {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "link_id")
    private String linkId;

    @Column(name = "link_slug", length = 120)
    private String linkSlug;

    @Column(name = "link_type", length = 30)
    private String linkType;

    @Column(name = "contact_name", length = 500)
    private String contactName;

    @Column(name = "contact_email", length = 500)
    private String contactEmail;

    @Column(name = "contact_phone", length = 100)
    private String contactPhone;

    @Column(name = "organization_name", length = 500)
    private String organizationName;

    @Column(name = "role")
    private String role;

    @Column(name = "institute_type", length = 50)
    private String instituteType;

    @Column(name = "source")
    private String source;

    /** JSON array of feature flags the prospect said yes to. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "features_of_interest", columnDefinition = "jsonb")
    private String featuresOfInterest;

    /** JSON object {questionKey: value} of the full answer payload. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "answers", columnDefinition = "jsonb")
    private String answers;

    @Column(name = "demo_institute_id")
    private String demoInstituteId;

    @Column(name = "status", length = 30, nullable = false)
    @Builder.Default
    private String status = "NEW";

    @Column(name = "email_sent", nullable = false)
    @Builder.Default
    private boolean emailSent = false;

    @Column(name = "referrer", length = 1000)
    private String referrer;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Date createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Date updatedAt;
}
