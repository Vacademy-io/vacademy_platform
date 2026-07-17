package vacademy.io.admin_core_service.features.onboarding.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

/**
 * One onboarding run of a flow for a single subject. {@code subjectUserId} is an
 * auth_service users.id with NO FK -- it is the one identifier stable across
 * "still a lead" and "already a student" states, keeping this domain independent
 * of audience_response/student/ssigm.
 */
@Entity
@Table(name = "onboarding_instance")
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class OnboardingInstance {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "flow_id", nullable = false)
    private String flowId;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "subject_user_id", nullable = false)
    private String subjectUserId;

    @Column(name = "current_step_id")
    private String currentStepId;

    @Column(name = "status", nullable = false)
    private String status; // IN_PROGRESS, COMPLETED, ABANDONED, CANCELLED

    @Column(name = "started_by", nullable = false)
    private String startedBy; // MANUAL, AUTO

    @Column(name = "started_by_user_id")
    private String startedByUserId;

    @Column(name = "source_event_name")
    private String sourceEventName;

    @Column(name = "source_event_id")
    private String sourceEventId;

    @Column(name = "started_at")
    private Date startedAt;

    @Column(name = "completed_at")
    private Date completedAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}
