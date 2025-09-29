package vacademy.io.admin_core_service.features.notification.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.notification.enums.NotificationEventType;
import vacademy.io.admin_core_service.features.notification.enums.NotificationSourceType;
import vacademy.io.admin_core_service.features.notification.enums.NotificationTemplateType;

import java.util.Date;

@Entity
@Table(name = "notification_event_config")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class NotificationEventConfig {

    @Id
    @Column(name = "id", length = 255)
    @UuidGenerator
    private String id;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_name", length = 100, nullable = false)
    private NotificationEventType eventName;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", length = 50, nullable = false)
    private NotificationSourceType sourceType;

    @Column(name = "source_id", length = 255, nullable = false)
    private String sourceId;

    @Enumerated(EnumType.STRING)
    @Column(name = "template_type", length = 50, nullable = false)
    private NotificationTemplateType templateType;

    @Column(name = "template_id", length = 255, nullable = false)
    private String templateId;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;

    @Column(name = "created_by", length = 255)
    private String createdBy;

    // Constructor for creating new configs
    public NotificationEventConfig(NotificationEventType eventName, NotificationSourceType sourceType, String sourceId, 
                                 NotificationTemplateType templateType, String templateId) {
        this.eventName = eventName;
        this.sourceType = sourceType;
        this.sourceId = sourceId;
        this.templateType = templateType;
        this.templateId = templateId;
        this.isActive = true;
    }
}
