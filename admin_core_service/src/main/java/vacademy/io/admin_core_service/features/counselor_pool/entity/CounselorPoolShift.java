package vacademy.io.admin_core_service.features.counselor_pool.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Time;
import java.sql.Timestamp;

/**
 * One block of the weekly schedule for a pool. Used only when the pool's
 * assignment_mode = TIME_BASED. Each row is (pool, day_of_week, start_time,
 * end_time). Times are wall-clock in the institute's timezone (Asia/Kolkata
 * in v1).
 *
 * Admin must configure 24/7 coverage across all 7 days; the API layer
 * validates this on save. Overlapping shifts are allowed (multi-counselor
 * coverage at the same moment).
 */
@Entity
@Table(name = "counselor_pool_shift")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CounselorPoolShift {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "pool_id", nullable = false)
    private String poolId;

    @Column(name = "day_of_week", nullable = false, length = 10)
    private String dayOfWeek; // ShiftDayOfWeek enum value: MON..SUN

    @Column(name = "start_time", nullable = false)
    private Time startTime;

    @Column(name = "end_time", nullable = false)
    private Time endTime;

    /** Optional human-friendly label like 'Morning shift', 'Evening shift'. */
    @Column(name = "label", length = 255)
    private String label;

    @Column(name = "status", nullable = false, length = 50)
    @Builder.Default
    private String status = "ACTIVE"; // PoolStatus enum value

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at")
    private Timestamp updatedAt;

    @PreUpdate
    protected void onUpdate() {
        updatedAt = new Timestamp(System.currentTimeMillis());
    }
}
