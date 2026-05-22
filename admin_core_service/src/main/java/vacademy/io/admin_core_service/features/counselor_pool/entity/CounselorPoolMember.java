package vacademy.io.admin_core_service.features.counselor_pool.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

/**
 * Per-(pool, audience, counselor) configuration row. This is the M*N matrix:
 * for each audience in the pool, every counselor in the pool gets a row here
 * with their display_order, status, and (future) monthly_target.
 *
 * A counselor is considered "in" the pool when at least one row exists for
 * them. Marking a counselor inactive in a pool flips all their rows for that
 * pool to status='INACTIVE'.
 *
 * When status='INACTIVE' AND backup_counselor_user_id is set, the routing
 * engine redirects leads that would go to this counselor to the backup.
 */
@Entity
@Table(name = "counselor_pool_member",
       uniqueConstraints = @UniqueConstraint(columnNames = {"pool_id", "audience_id", "counselor_user_id"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CounselorPoolMember {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "pool_id", nullable = false)
    private String poolId;

    @Column(name = "audience_id", nullable = false)
    private String audienceId;

    @Column(name = "counselor_user_id", nullable = false)
    private String counselorUserId;

    /** Position in round-robin sequence (per audience). Smaller = earlier in rotation. */
    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;

    /** Reserved column. No logic reads this yet; admin can set it for future target tracking. */
    @Column(name = "monthly_target")
    private Integer monthlyTarget;

    @Column(name = "status", nullable = false, length = 50)
    @Builder.Default
    private String status = "ACTIVE"; // PoolStatus enum value

    /** When status='INACTIVE', redirect this counselor's leads to this user. NULL = skip in rotation. */
    @Column(name = "backup_counselor_user_id")
    private String backupCounselorUserId;

    @Column(name = "added_by")
    private String addedBy;

    @Column(name = "added_at", insertable = false, updatable = false)
    private Timestamp addedAt;

    @Column(name = "updated_at")
    private Timestamp updatedAt;

    @PreUpdate
    protected void onUpdate() {
        updatedAt = new Timestamp(System.currentTimeMillis());
    }
}
