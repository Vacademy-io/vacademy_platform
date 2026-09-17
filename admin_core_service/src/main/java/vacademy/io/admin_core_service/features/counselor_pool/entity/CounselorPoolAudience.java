package vacademy.io.admin_core_service.features.counselor_pool.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

/**
 * Links a pool to a campaign (audience). One audience can belong to at most one
 * pool at a time (enforced via UNIQUE on audience_id).
 *
 * The per-audience round-robin pointer (last_assigned_counselor_id) lives here
 * so each campaign in the pool cycles through counselors independently.
 */
@Entity
@Table(name = "counselor_pool_audience",
       uniqueConstraints = @UniqueConstraint(columnNames = {"audience_id"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CounselorPoolAudience {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "pool_id", nullable = false)
    private String poolId;

    @Column(name = "audience_id", nullable = false, unique = true)
    private String audienceId;

    /** Round-robin pointer. NULL before the first assignment ever happens. */
    @Column(name = "last_assigned_counselor_id")
    private String lastAssignedCounselorId;

    @Column(name = "last_assigned_at")
    private Timestamp lastAssignedAt;

    @Column(name = "added_at", insertable = false, updatable = false)
    private Timestamp addedAt;
}
