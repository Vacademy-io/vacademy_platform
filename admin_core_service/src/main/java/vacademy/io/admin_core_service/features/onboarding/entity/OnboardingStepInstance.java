package vacademy.io.admin_core_service.features.onboarding.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

@Entity
@Table(name = "onboarding_step_instance")
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class OnboardingStepInstance {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "onboarding_instance_id", nullable = false)
    private String onboardingInstanceId;

    @Column(name = "step_id", nullable = false)
    private String stepId;

    @Column(name = "status", nullable = false)
    private String status; // PENDING, IN_PROGRESS, COMPLETED, SKIPPED

    @Column(name = "entered_at")
    private Date enteredAt;

    @Column(name = "completed_at")
    private Date completedAt;

    @Column(name = "completed_by_user_id")
    private String completedByUserId;

    @Column(name = "completed_by_role")
    private String completedByRole; // ADMIN, STUDENT, PARENT, SYSTEM

    @Column(name = "skip_reason")
    private String skipReason;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}
