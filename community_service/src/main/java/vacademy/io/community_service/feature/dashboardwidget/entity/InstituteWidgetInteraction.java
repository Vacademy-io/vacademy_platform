package vacademy.io.community_service.feature.dashboardwidget.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.community_service.feature.dashboardwidget.enums.InteractionType;

import java.util.Date;

/**
 * An institute-side action on a widget: a free-text comment or a milestone confirmation.
 * {@code milestoneId} is set when the interaction is scoped to a specific onboarding milestone.
 */
@Entity
@Table(name = "institute_widget_interaction", schema = "public")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "id")
public class InstituteWidgetInteraction {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "widget_id", nullable = false)
    private String widgetId;

    @Column(name = "milestone_id")
    private String milestoneId;

    @Enumerated(EnumType.STRING)
    @Column(name = "interaction_type", length = 30, nullable = false)
    private InteractionType interactionType;

    @Column(name = "message", columnDefinition = "text")
    private String message;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "user_name", length = 500)
    private String userName;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Date createdAt;
}
