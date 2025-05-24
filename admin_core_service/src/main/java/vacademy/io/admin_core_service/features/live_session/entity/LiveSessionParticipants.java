package vacademy.io.admin_core_service.features.live_session.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.GenericGenerator;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "live_session_participants")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LiveSessionParticipants {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "session_id", nullable = false)
    private String sessionId;

    @Column(name = "source_type", nullable = false)
    private String sourceType; // e.g. 'batch' or 'user'

    @Column(name = "source_id", nullable = false)
    private String sourceId;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
