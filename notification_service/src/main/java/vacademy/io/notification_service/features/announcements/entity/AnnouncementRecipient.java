package vacademy.io.notification_service.features.announcements.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.notification_service.features.announcements.enums.RecipientType;

import java.time.LocalDateTime;

@Entity
@Table(name = "announcement_recipients")
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class AnnouncementRecipient {
    @UuidGenerator
    @Id
    private String id;
    
    @Column(name = "announcement_id", nullable = false)
    private String announcementId;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "announcement_id", insertable = false, updatable = false)
    private Announcement announcement;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "recipient_type", nullable = false)
    private RecipientType recipientType;
    
    @Column(name = "recipient_id", nullable = false)
    private String recipientId;
    
    @Column(name = "recipient_name")
    private String recipientName;
    
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;
    
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
    
    // Helper method to check if this is an exclusion (using prefix convention)
    public boolean isExclusion() {
        return recipientId != null && recipientId.startsWith("EXCLUDE:");
    }
    
    // Get the actual recipient ID without the exclusion prefix
    public String getActualRecipientId() {
        if (isExclusion()) {
            return recipientId.substring("EXCLUDE:".length());
        }
        return recipientId;
    }
}