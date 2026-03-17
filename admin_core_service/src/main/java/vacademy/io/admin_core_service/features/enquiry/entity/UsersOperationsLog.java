package vacademy.io.admin_core_service.features.enquiry.entity;

import jakarta.persistence.*;
import lombok.*;

import java.sql.Timestamp;
import java.util.UUID;

/**
 * Entity representing audit log for user operations
 * Tracks changes made to various entities
 */
@Entity
@Table(name = "users_operations_log")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UsersOperationsLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, unique = true)
    private UUID id;

    @Column(name = "action_user_id")
    private String actionUserId; // User performing the action

    @Column(name = "source")
    private String source; // Target resource type

    @Column(name = "source_id")
    private String sourceId; // Target resource ID

    @Column(name = "created_by")
    private String createdBy; // Name or ID of creator

    @Column(name = "from_value", columnDefinition = "TEXT")
    private String fromValue;

    @Column(name = "to_value", columnDefinition = "TEXT")
    private String toValue;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;
}
