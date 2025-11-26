package vacademy.io.notification_service.features.announcements.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;
import vacademy.io.notification_service.features.announcements.enums.AnnouncementChannel;

import java.time.LocalDateTime;
import java.util.Map;

@Entity
@Table(name = "user_announcement_settings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UserAnnouncementSetting {

    @Id
    @UuidGenerator
    private String id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Enumerated(EnumType.STRING)
    @Column(name = "channel", nullable = false)
    private AnnouncementChannel channel;

    @Column(name = "source_identifier", nullable = false)
    private String sourceIdentifier;

    @Column(name = "is_unsubscribed", nullable = false)
    private boolean unsubscribed;

    @Column(name = "unsubscribed_at")
    private LocalDateTime unsubscribedAt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metadata")
    private Map<String, Object> metadata;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}

