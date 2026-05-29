package vacademy.io.admin_core_service.features.counselor_pool.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

/**
 * A pool that groups counselors and links to one or more campaigns (audiences).
 * Each pool picks ONE assignment_mode (MANUAL | ROUND_ROBIN | TIME_BASED) which
 * governs how leads arriving on its audiences get routed to a counselor.
 */
@Entity
@Table(name = "counselor_pool")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CounselorPool {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "name", nullable = false, length = 255)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "assignment_mode", nullable = false, length = 50)
    private String assignmentMode; // AssignmentMode enum value

    /**
     * How the admin authored the weekly schedule (TIME_BASED pools only).
     * Drives which editor the UI renders when the pool is reopened. NULL
     * means the admin hasn't picked yet — UI shows the empty-state chooser.
     * Routing engine ignores this field — it reads flat shift rows.
     */
    @Column(name = "schedule_pattern", length = 50)
    private String schedulePattern; // SchedulePattern enum value, or null

    @Column(name = "created_by")
    private String createdBy;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at")
    private Timestamp updatedAt;

    @PreUpdate
    protected void onUpdate() {
        updatedAt = new Timestamp(System.currentTimeMillis());
    }
}
