package vacademy.io.notification_service.features.announcements.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.notification_service.features.announcements.enums.MediumType;
import vacademy.io.notification_service.features.announcements.enums.MessageStatus;
import vacademy.io.notification_service.features.announcements.enums.ModeType;

import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "recipient_messages")
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class RecipientMessage {
    @UuidGenerator
    @Id
    private String id;
    
    @Column(name = "announcement_id", nullable = false)
    private String announcementId;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "announcement_id", insertable = false, updatable = false)
    private Announcement announcement;
    
    @Column(name = "user_id", nullable = false)
    private String userId;
    
    @Column(name = "user_name")
    private String userName;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "mode_type", nullable = false)
    private ModeType modeType;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "medium_type")
    private MediumType mediumType;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MessageStatus status = MessageStatus.PENDING;
    
    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;
    
    @Column(name = "sent_at")
    private LocalDateTime sentAt;
    
    @Column(name = "delivered_at")
    private LocalDateTime deliveredAt;
    
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
    
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();
    
    // Relationships
    @OneToMany(mappedBy = "recipientMessage", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<MessageInteraction> interactions;
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}