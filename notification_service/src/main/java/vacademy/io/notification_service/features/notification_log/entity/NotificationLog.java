package vacademy.io.notification_service.features.notification_log.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDateTime;

@Entity
@Table(name = "notification_log")
@Getter
@Setter
public class NotificationLog {

    @Id
    @Column(length = 255, nullable = false)
    @UuidGenerator
    private String id;

    @Column(name = "notification_type", length = 20, nullable = false)
    private String notificationType;

    @Column(name = "channel_id", length = 255, nullable = false)
    private String channelId;

    @Column(name = "body")
    private String body;

    @Column(name = "source", length = 255)
    private String source;

    @Column(name = "source_id", length = 255)
    private String sourceId;

    @Column(name = "user_id", length = 255)
    private String userId;

    @Column(name = "notification_date")
    private LocalDateTime notificationDate;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // Add to your existing NotificationLog class
    @Column(name = "sender_business_channel_id")
    private String senderBusinessChannelId;

    @Column(name = "message_payload", columnDefinition = "TEXT")
    private String messagePayload;
}
