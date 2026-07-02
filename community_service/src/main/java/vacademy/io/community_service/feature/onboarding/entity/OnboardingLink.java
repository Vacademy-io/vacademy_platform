package vacademy.io.community_service.feature.onboarding.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

import java.util.Date;

/** A generated, shareable onboarding link and the form config it renders. */
@Entity
@Table(name = "onboarding_link", schema = "public")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "id")
public class OnboardingLink {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "slug", length = 120, nullable = false, unique = true)
    private String slug;

    @Column(name = "name", length = 500, nullable = false)
    private String name;

    /** GENERAL | CUSTOM | DIRECT_DEMO (stored as string). */
    @Column(name = "link_type", length = 30, nullable = false)
    @Builder.Default
    private String linkType = "GENERAL";

    /** JSON array of question keys to show; null/empty => all questions. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "visible_question_keys", columnDefinition = "jsonb")
    private String visibleQuestionKeys;

    /** JSON object {questionKey: value} of known answers, prefilled and hidden from the prospect. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "prefilled_values", columnDefinition = "jsonb")
    private String prefilledValues;

    @Column(name = "forced_institute_type", length = 50)
    private String forcedInstituteType;

    @Column(name = "intro_heading", length = 500)
    private String introHeading;

    @Column(name = "intro_subheading", length = 1000)
    private String introSubheading;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private boolean active = true;

    @Column(name = "expires_at")
    private Date expiresAt;

    @Column(name = "submission_count", nullable = false)
    @Builder.Default
    private int submissionCount = 0;

    @Column(name = "created_by_user_id")
    private String createdByUserId;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Date createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Date updatedAt;
}
