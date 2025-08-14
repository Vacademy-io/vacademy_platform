package vacademy.io.notification_service.features.firebase_notifications.entity;

import java.time.LocalDateTime;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Entity
@Table(name = "fcm_tokens")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FcmToken {

    @Id
    @Column(name = "id", nullable = false, unique = true, length = 255)
    private String id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "institute_id")
    private String instituteId;

    @Column(name = "token", nullable = false, columnDefinition = "TEXT")
    private String token;

    @Column(name = "platform")
    private String platform; // web, android, ios

    @Column(name = "device_id")
    private String deviceId;

    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public FcmToken(String userId, String token, String platform, String deviceId) {
        this.id = UUID.randomUUID().toString();
        this.userId = userId;
        this.token = token;
        this.platform = platform;
        this.deviceId = deviceId;
        this.isActive = true;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    public FcmToken(String instituteId, String userId, String token, String platform, String deviceId) {
        this.id = UUID.randomUUID().toString();
        this.instituteId = instituteId;
        this.userId = userId;
        this.token = token;
        this.platform = platform;
        this.deviceId = deviceId;
        this.isActive = true;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PrePersist
    protected void onCreate() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (updatedAt == null) {
            updatedAt = LocalDateTime.now();
        }
        if (isActive == null) {
            isActive = true;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}