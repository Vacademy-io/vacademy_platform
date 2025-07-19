package vacademy.io.common.auth.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_activity_log")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserActivityLog {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "institute_id")
    private String instituteId;

    @Column(name = "service_name", length = 100)
    private String serviceName;

    @Column(name = "endpoint", length = 500)
    private String endpoint;

    @Column(name = "action_type", length = 50)
    private String actionType; // LOGIN, API_CALL, LOGOUT, etc.

    @Column(name = "session_id")
    private String sessionId;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "user_agent", length = 500)
    private String userAgent;

    @Column(name = "device_type", length = 50)
    private String deviceType;

    @Column(name = "response_status")
    private Integer responseStatus;

    @Column(name = "response_time_ms")
    private Long responseTimeMs;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
} 