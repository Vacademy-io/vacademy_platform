package vacademy.io.admin_core_service.features.enquiry.entity;

import jakarta.persistence.*;
import lombok.*;

import java.sql.Timestamp;
import java.util.UUID;

/**
 * Entity representing events linked to a source (polymorphic association)
 */
@Entity
@Table(name = "linked_events")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LinkedEvents {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, unique = true)
    private UUID id;

    @Column(name = "source")
    private String source; // Polymorphic Source Type

    @Column(name = "source_id")
    private String sourceId; // Polymorphic Source ID

    @Column(name = "linked_session_id")
    private String linkedSessionId; // References live_session(id)

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;
}
