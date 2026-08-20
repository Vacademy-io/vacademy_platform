package vacademy.io.admin_core_service.features.learner_access.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Temporal;
import jakarta.persistence.TemporalType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

/**
 * Append-only history of every change to a learner's course access window.
 *
 * <p>The live value stays on {@code student_session_institute_group_mapping.expiry_date};
 * this table records how it got there. Rows are never updated after insert.
 */
@Entity
@Table(name = "learner_access_log")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LearnerAccessLog {

    @Id
    @UuidGenerator
    @Column(name = "id", length = 255, nullable = false, updatable = false)
    private String id;

    @Column(name = "institute_id", length = 255, nullable = false)
    private String instituteId;

    @Column(name = "user_id", length = 255, nullable = false)
    private String userId;

    @Column(name = "package_session_id", length = 255)
    private String packageSessionId;

    @Column(name = "mapping_id", length = 255)
    private String mappingId;

    @Column(name = "source", length = 64, nullable = false)
    private String source;

    @Column(name = "action", length = 64, nullable = false)
    private String action;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "previous_expiry_date")
    private Date previousExpiryDate;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "new_expiry_date")
    private Date newExpiryDate;

    @Column(name = "days_delta")
    private Integer daysDelta;

    @Column(name = "access_days")
    private Integer accessDays;

    @Column(name = "user_plan_id", length = 255)
    private String userPlanId;

    @Column(name = "payment_plan_id", length = 255)
    private String paymentPlanId;

    @Column(name = "enroll_invite_id", length = 255)
    private String enrollInviteId;

    @Column(name = "reason", columnDefinition = "TEXT")
    private String reason;

    @Column(name = "actor_id", length = 255)
    private String actorId;

    @Column(name = "actor_name", length = 255)
    private String actorName;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}
