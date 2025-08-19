package vacademy.io.notification_service.features.announcements.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDateTime;

@Entity
@Table(name = "announcement_system_alerts")
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class AnnouncementSystemAlert {
    @UuidGenerator
    @Id
    private String id;
    
    @Column(name = "announcement_id", nullable = false)
    private String announcementId;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "announcement_id", insertable = false, updatable = false)
    private Announcement announcement;
    
    @Column(nullable = false)
    private Integer priority = 1; // 1=low, 2=medium, 3=high
    
    @Column(name = "is_dismissible", nullable = false)
    private Boolean isDismissible = true;
    
    @Column(name = "auto_dismiss_after_hours")
    private Integer autoDismissAfterHours;
    
    @Column(name = "show_badge", nullable = false)
    private Boolean showBadge = true;
    
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;
    
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}