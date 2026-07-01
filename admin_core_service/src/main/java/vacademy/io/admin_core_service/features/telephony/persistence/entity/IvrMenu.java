package vacademy.io.admin_core_service.features.telephony.persistence.entity;

import jakarta.persistence.*;
import lombok.*;

import java.sql.Timestamp;

/**
 * One IVR menu (tree) an institute attaches to a DID. The tree of {@link IvrNode}s
 * is walked when a lead calls in. See V352.
 */
@Entity
@Table(name = "ivr_menu")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IvrMenu {

    @Id
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "institute_id", nullable = false, length = 36)
    private String instituteId;

    @Column(name = "name", nullable = false, length = 128)
    private String name;

    /** DID this IVR answers; null = the institute's default menu. */
    @Column(name = "dialed_number", length = 20)
    private String dialedNumber;

    /** Entry node id (soft reference to ivr_node.id). */
    @Column(name = "root_node_id", length = 36)
    private String rootNodeId;

    @Column(name = "enabled", nullable = false)
    @Builder.Default
    private Boolean enabled = true;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;
}
