package vacademy.io.community_service.feature.onboarding.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

/** One of the four demo institutes a prospect can be dropped into. Editable in the Demo tab. */
@Entity
@Table(name = "onboarding_demo_account", schema = "public")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "id")
public class OnboardingDemoAccount {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    /** SCHOOL | DISTANCE_LEARNING | CORPORATE | UNIVERSITY (stored as string). */
    @Column(name = "institute_type", length = 50, nullable = false, unique = true)
    private String instituteType;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "display_name", length = 500, nullable = false)
    private String displayName;

    @Column(name = "admin_username")
    private String adminUsername;

    @Column(name = "admin_password")
    private String adminPassword;

    @Column(name = "learner_username")
    private String learnerUsername;

    @Column(name = "learner_password")
    private String learnerPassword;

    @Column(name = "admin_portal_url", length = 1000)
    private String adminPortalUrl;

    @Column(name = "learner_portal_url", length = 1000)
    private String learnerPortalUrl;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private boolean active = true;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private int sortOrder = 0;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Date createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Date updatedAt;
}
