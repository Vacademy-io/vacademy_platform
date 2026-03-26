package vacademy.io.admin_core_service.features.live_session.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

@Entity
@Table(name = "live_session_notification_config")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LiveSessionNotificationConfig {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "session_id", nullable = false)
    private String sessionId;

    @Column(name = "notification_type", nullable = false, length = 30)
    private String notificationType;

    @Column(name = "channels", nullable = false, length = 100)
    private String channels;

    @Column(name = "enabled")
    private Boolean enabled;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}
