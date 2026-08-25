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
 * A learner asking to be mentored. This is the pull half of mentorship: the
 * learner picks a mentor from the directory (or leaves {@code mentorId} null for
 * "any available mentor") and an admin approves or declines. Approval creates the
 * ordinary {@link MentorStudentAssignment} row, so everything downstream —
 * feeds, notifications, booking — is unchanged.
 *
 * <p>A student has at most one PENDING request per mentor (partial unique index);
 * declined/cancelled requests can be re-raised.
 */
@Entity
@Table(name = "mentor_request")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MentorRequest {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    /** The requesting learner's platform (auth) user id. */
    @Column(name = "student_user_id", nullable = false)
    private String studentUserId;

    /** The requested mentor, or null for "any available mentor". */
    @Column(name = "mentor_id")
    private String mentorId;

    /** The learner's note — what they want help with. */
    @Column(name = "message")
    private String message;

    /** PENDING | APPROVED | DECLINED | CANCELLED */
    @Column(name = "status", nullable = false)
    private String status;

    @Column(name = "decided_by_user_id")
    private String decidedByUserId;

    @Column(name = "decided_at")
    private Timestamp decidedAt;

    /** Admin's reason; surfaced to the learner when a request is declined. */
    @Column(name = "decision_note")
    private String decisionNote;

    /** The assignment created on approval — the audit link between request and pairing. */
    @Column(name = "assignment_id")
    private String assignmentId;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;
}
