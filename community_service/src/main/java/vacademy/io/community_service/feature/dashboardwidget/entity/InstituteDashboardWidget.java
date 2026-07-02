package vacademy.io.community_service.feature.dashboardwidget.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;
import vacademy.io.community_service.feature.dashboardwidget.enums.WidgetStatus;
import vacademy.io.community_service.feature.dashboardwidget.enums.WidgetTargetType;
import vacademy.io.community_service.feature.dashboardwidget.enums.WidgetType;

import java.util.Date;

/**
 * A super-admin-managed widget rendered on an institute admin's dashboard. Targeted at a single
 * institute or a lead-tag group. {@code payload} and {@code visibleRoles} are jsonb stored as
 * strings; (de)serialization is done in the service via Jackson (mirrors {@code SupportTicket}).
 */
@Entity
@Table(name = "institute_dashboard_widget", schema = "public")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "id")
public class InstituteDashboardWidget {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Enumerated(EnumType.STRING)
    @Column(name = "widget_type", length = 50, nullable = false)
    private WidgetType widgetType;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", length = 30, nullable = false)
    @Builder.Default
    private WidgetTargetType targetType = WidgetTargetType.INSTITUTE;

    /** instituteId when targetType=INSTITUTE; a lead tag (PROD|LEAD|TEST|FREE_TRIAL) when LEAD_TAG. */
    @Column(name = "target_value", nullable = false)
    private String targetValue;

    /** JSON array of role keys allowed to see this widget; NULL/empty => ADMIN only. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "visible_roles", columnDefinition = "jsonb")
    private String visibleRoles;

    @Column(name = "title", length = 500, nullable = false)
    private String title;

    /** Type-specific jsonb payload (milestones[] for the tracker, body/severity for an info card). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "payload", columnDefinition = "jsonb")
    private String payload;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 30, nullable = false)
    @Builder.Default
    private WidgetStatus status = WidgetStatus.DRAFT;

    @Column(name = "position", nullable = false)
    @Builder.Default
    private int position = 0;

    /** Reserved for a future scheduled window — unused in v1. */
    @Column(name = "starts_at")
    private Date startsAt;

    @Column(name = "ends_at")
    private Date endsAt;

    @Column(name = "created_by")
    private String createdBy;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Date createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Date updatedAt;
}
