package vacademy.io.common.auth.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_session")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserSession {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "institute_id")
    private String instituteId;

    @Column(name = "session_token", unique = true, nullable = false)
    private String sessionToken;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "user_agent", length = 500)
    private String userAgent;

    @Column(name = "device_type", length = 50)
    private String deviceType;

    @Column(name = "device_id", length = 100)
    private String deviceId;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "login_time", nullable = false)
    private LocalDateTime loginTime;

    @Column(name = "last_activity_time", nullable = false)
    private LocalDateTime lastActivityTime;

    @Column(name = "logout_time")
    private LocalDateTime logoutTime;

    @Column(name = "session_duration_minutes")
    private Long sessionDurationMinutes;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (loginTime == null) {
            loginTime = LocalDateTime.now();
        }
        if (lastActivityTime == null) {
            lastActivityTime = LocalDateTime.now();
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
        if (logoutTime != null && loginTime != null) {
            sessionDurationMinutes = java.time.Duration.between(loginTime, logoutTime).toMinutes();
        }
    }
} 