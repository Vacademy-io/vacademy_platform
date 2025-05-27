package vacademy.io.admin_core_service.features.live_session.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDateTime;
import java.util.Date;
import java.util.UUID;

@Entity
@Table(name = "schedule_notifications")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ScheduleNotification {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "session_id", nullable = false)
    private String sessionId;

    @Column(nullable = false)
    private String type; // pre, post, attendance

    @Column(columnDefinition = "TEXT")
    private String message;

    @Column
    private String status; // pending, sent

    @Column
    private String channel; // email, whatsapp, etc.

    @Column(name = "trigger_time")
    private LocalDateTime triggerTime;

    @Column(name = "offset_minutes")
    private Integer offsetMinutes;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}

