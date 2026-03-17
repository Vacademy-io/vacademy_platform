package vacademy.io.admin_core_service.features.enquiry.entity;

import jakarta.persistence.*;
import lombok.*;

import java.sql.Timestamp;
import java.util.UUID;

/**
 * Entity representing users linked to a source (polymorphic association)
 */
@Entity
@Table(name = "linked_users")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LinkedUsers {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, unique = true)
    private UUID id;

    @Column(name = "source")
    private String source; // Polymorphic Source Type

    @Column(name = "source_id")
    private String sourceId; // Polymorphic Source ID

    @Column(name = "user_id")
    private String userId;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;
}
