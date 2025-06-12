package vacademy.io.admin_core_service.features.live_session.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

@Entity
@Table(name = "live_session_logs")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LiveSessionLogs {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(nullable = false)
    private String sessionId;

    @Column(nullable = false)
    private String scheduleId;

    @Column(name = "user_source_type", nullable = false, length = 30)
    private String userSourceType;

    @Column(name = "user_source_id", nullable = false, length = 255)
    private String userSourceId;

    @Column(name = "log_type", nullable = false, length = 30)
    private String logType;

    @Column(length = 20)
    private String status;

    @Column(columnDefinition = "TEXT")
    private String details;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;
}

