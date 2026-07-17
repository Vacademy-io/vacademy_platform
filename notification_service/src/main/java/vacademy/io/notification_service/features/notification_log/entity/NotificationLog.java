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

import java.time.Instant;

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
    private Instant notificationDate;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "sender_business_channel_id")
    private String senderBusinessChannelId;

    @Column(name = "message_payload", columnDefinition = "TEXT")
    private String messagePayload;

    @Column(name = "sender_name")
    private String senderName;

    @Column(name = "institute_id", length = 255)
    private String instituteId;

    /**
     * Caller-supplied correlation key (e.g. an Engagement Engine action id) stamped at send time
     * and copied onto the status/read rows the webhooks write for the same message. Distinct from
     * source_id, which carries the provider message id (WhatsApp wamid / email Message-ID) that
     * webhook joins depend on — the two must never share a column. Added V31.
     */
    @Column(name = "correlation_id", length = 255)
    private String correlationId;
}
