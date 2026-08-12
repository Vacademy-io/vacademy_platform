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
 * Send-once ledger for scheduler-driven mentorship notifications. A row means the
 * notification for {@code (notificationType, refId)} was already dispatched, so the
 * jobs stay idempotent across ticks and restarts. SESSION_REMINDER rows are unique
 * per booking (partial index, V434); CHECKIN_NUDGE rows accumulate — the newest
 * one gates the re-nudge cadence.
 */
@Entity
@Table(name = "mentorship_notification_log")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MentorshipNotificationLog {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    /** SESSION_REMINDER | CHECKIN_NUDGE */
    @Column(name = "notification_type", nullable = false)
    private String notificationType;

    /** booking_instance.id for SESSION_REMINDER; mentor_student_assignment.id for CHECKIN_NUDGE. */
    @Column(name = "ref_id", nullable = false)
    private String refId;

    @Column(name = "sent_at", insertable = false, updatable = false)
    private Timestamp sentAt;
}
