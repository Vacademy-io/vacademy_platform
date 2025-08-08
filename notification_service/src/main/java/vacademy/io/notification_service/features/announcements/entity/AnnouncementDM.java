package vacademy.io.notification_service.features.announcements.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.notification_service.features.announcements.enums.MessagePriority;

import java.time.LocalDateTime;

@Entity
@Table(name = "announcement_dms")
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class AnnouncementDM {
    @UuidGenerator
    @Id
    private String id;
    
    @Column(name = "announcement_id", nullable = false)
    private String announcementId;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "announcement_id", insertable = false, updatable = false)
    private Announcement announcement;
    
    @Column(name = "is_reply_allowed", nullable = false)
    private Boolean isReplyAllowed = true;
    
    @Column(name = "is_forwarding_allowed", nullable = false)
    private Boolean isForwardingAllowed = false;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "message_priority", nullable = false)
    private MessagePriority messagePriority = MessagePriority.NORMAL;
    
    @Column(name = "delivery_confirmation_required", nullable = false)
    private Boolean deliveryConfirmationRequired = false;
    
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;
    
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}