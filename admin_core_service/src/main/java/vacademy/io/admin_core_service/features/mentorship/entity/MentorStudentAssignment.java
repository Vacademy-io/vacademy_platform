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
 * A mentor↔student mentorship link. Many-to-many: a student may have multiple
 * mentors and a mentor many students. A given (mentor, student) pair exists at
 * most once while ACTIVE (partial unique index). {@code mentorUserId} is a
 * denormalized copy of {@code mentor.user_id} so mentor-facing feeds ("my
 * mentees") can filter without joining the mentor table.
 */
@Entity
@Table(name = "mentor_student_assignment")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MentorStudentAssignment {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "mentor_id", nullable = false)
    private String mentorId;

    /** Denormalized mentor.user_id — the mentor's platform user id. */
    @Column(name = "mentor_user_id", nullable = false)
    private String mentorUserId;

    /** The mentee's platform (auth) user id. */
    @Column(name = "student_user_id", nullable = false)
    private String studentUserId;

    /** Optional link to the specific enrollment (student_session_institute_group_mapping row). */
    @Column(name = "ssigm_id")
    private String ssigmId;

    @Column(name = "package_session_id")
    private String packageSessionId;

    /** MANUAL | ROUND_ROBIN | BULK */
    @Column(name = "assignment_method", nullable = false)
    private String assignmentMethod;

    @Column(name = "assigned_by_user_id")
    private String assignedByUserId;

    /** ACTIVE | INACTIVE | DELETED */
    @Column(name = "status", nullable = false)
    private String status;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;
}
