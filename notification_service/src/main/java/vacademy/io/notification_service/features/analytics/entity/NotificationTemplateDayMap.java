package vacademy.io.notification_service.features.analytics.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDateTime;

/**
 * Entity mapping for notification_template_day_map table
 * Maps workflow day templates to notification_log for analytics tracking
 */
@Entity
@Table(name = "notification_template_day_map")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NotificationTemplateDayMap {

    @Id
    @UuidGenerator
    @Column(length = 255)
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "sender_business_channel_id", nullable = false, length = 255)
    private String senderBusinessChannelId;

    @Column(name = "day_number", nullable = false)
    private Integer dayNumber;

    @Column(name = "day_label", nullable = false, length = 255)
    private String dayLabel;

    @Column(name = "template_identifier", nullable = false, length = 255)
    private String templateIdentifier;

    @Column(name = "sub_template_label", length = 255)
    private String subTemplateLabel;

    @Column(name = "notification_type", nullable = false, length = 50)
    private String notificationType; // WHATSAPP_MESSAGE_OUTGOING, WHATSAPP_MESSAGE_INCOMING, EMAIL_OUTGOING, etc.

    @Column(name = "channel_type", nullable = false, length = 50)
    private String channelType; // WHATSAPP, EMAIL, SMS, PUSH_NOTIFICATION, etc.

    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (isActive == null) {
            isActive = true;
        }
        if (notificationType == null) {
            notificationType = "WHATSAPP_MESSAGE_OUTGOING";
        }
        if (channelType == null) {
            channelType = "WHATSAPP";
        }
    }
}
