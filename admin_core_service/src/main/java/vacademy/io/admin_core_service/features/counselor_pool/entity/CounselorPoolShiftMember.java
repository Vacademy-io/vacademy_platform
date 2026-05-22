package vacademy.io.admin_core_service.features.counselor_pool.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

/**
 * A counselor assigned to a specific shift block. One shift can carry many
 * counselors (multi-occupancy); within a shift, the routing engine orders
 * candidates by counselor_pool_member.display_order for the relevant audience.
 */
@Entity
@Table(name = "counselor_pool_shift_member",
       uniqueConstraints = @UniqueConstraint(columnNames = {"shift_id", "counselor_user_id"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CounselorPoolShiftMember {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "shift_id", nullable = false)
    private String shiftId;

    @Column(name = "counselor_user_id", nullable = false)
    private String counselorUserId;

    @Column(name = "status", nullable = false, length = 50)
    @Builder.Default
    private String status = "ACTIVE"; // PoolStatus enum value

    @Column(name = "added_at", insertable = false, updatable = false)
    private Timestamp addedAt;
}
