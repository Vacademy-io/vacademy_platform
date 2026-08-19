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
 * The mentor's record of one session: did it happen, and what came out of it.
 *
 * <p>Pairs with {@link MentorSessionFeedback} — same session, the two sides of it.
 * The session itself remains a {@code booking_instance}; this adds the mentorship
 * outcome without changing booking semantics shared with non-mentorship bookings.
 */
@Entity
@Table(name = "mentor_session_record")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MentorSessionRecord {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    /** The session this records (booking_instance.id). */
    @Column(name = "booking_instance_id", nullable = false)
    private String bookingInstanceId;

    @Column(name = "mentor_id", nullable = false)
    private String mentorId;

    @Column(name = "mentor_user_id", nullable = false)
    private String mentorUserId;

    @Column(name = "student_user_id", nullable = false)
    private String studentUserId;

    /** COMPLETED | NO_SHOW */
    @Column(name = "outcome", nullable = false)
    private String outcome;

    /** Mentor's notes — visible to the mentor and admins, never to the learner. */
    @Column(name = "notes")
    private String notes;

    /** What the session covered, for the admin session list. */
    @Column(name = "topic")
    private String topic;

    @Column(name = "marked_by_user_id")
    private String markedByUserId;

    @Column(name = "marked_at")
    private Timestamp markedAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;
}
