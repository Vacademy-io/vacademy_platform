package vacademy.io.admin_core_service.features.mentorship.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

/**
 * A learner's rating of one mentor session. Attached to the {@code booking_instance}
 * that already represents the session, so the same rows serve both the per-session
 * view and a mentor's running average. One row per (session, learner) — re-rating
 * updates it rather than adding a second.
 *
 * <p>The 1-5 bound is a DB check constraint as well as a service validation, so a
 * misbehaving client can never store an out-of-range score.
 */
@Entity
@Table(name = "mentor_session_feedback")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MentorSessionFeedback {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    /** The rated session (booking_instance.id). */
    @Column(name = "booking_instance_id", nullable = false)
    private String bookingInstanceId;

    @Column(name = "mentor_id", nullable = false)
    private String mentorId;

    /** Denormalized mentor.user_id so mentor-facing reads don't need a join. */
    @Column(name = "mentor_user_id", nullable = false)
    private String mentorUserId;

    @Column(name = "student_user_id", nullable = false)
    private String studentUserId;

    /** 1-5. */
    @Column(name = "rating", nullable = false)
    private Integer rating;

    @Column(name = "comment")
    private String comment;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;
}
