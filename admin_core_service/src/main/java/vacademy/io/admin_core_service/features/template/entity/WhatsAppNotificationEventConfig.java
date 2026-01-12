package vacademy.io.admin_core_service.features.template.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "notification_event_config")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class WhatsAppNotificationEventConfig {

    @Id
    @Column(name = "id", length = 255)
    private String id;

    @Column(name = "event_name", length = 100, nullable = false)
    private String eventName;

    @Column(name = "source_type", length = 50, nullable = false)
    private String sourceType;

    @Column(name = "source_id", length = 255, nullable = false)
    private String sourceId;

    @Column(name = "template_type", length = 50, nullable = false)
    private String templateType;

    @Column(name = "template_id", length = 255, nullable = false)
    private String templateId;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "created_by", length = 255)
    private String createdBy;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
