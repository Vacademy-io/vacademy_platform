package vacademy.io.notification_service.features.announcements.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDateTime;

@Entity
@Table(name = "announcement_dashboard_pins")
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class AnnouncementDashboardPin {
    @UuidGenerator
    @Id
    private String id;
    
    @Column(name = "announcement_id", nullable = false)
    private String announcementId;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "announcement_id", insertable = false, updatable = false)
    private Announcement announcement;
    
    @Column(name = "pin_duration_hours", nullable = false)
    private Integer pinDurationHours = 24;
    
    @Column(nullable = false)
    private Integer priority = 1; // Higher number = higher priority
    
    @Column(length = 50, nullable = false)
    private String position = "top"; // top, middle, bottom
    
    @Column(name = "background_color", length = 20)
    private String backgroundColor;
    
    @Column(name = "is_dismissible", nullable = false)
    private Boolean isDismissible = true;
    
    @Column(name = "pin_start_time", nullable = false)
    private LocalDateTime pinStartTime = LocalDateTime.now();
    
    @Column(name = "pin_end_time")
    private LocalDateTime pinEndTime;
    
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;
    
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
    
    @PrePersist
    protected void onCreate() {
        if (pinEndTime == null && pinDurationHours != null) {
            pinEndTime = pinStartTime.plusHours(pinDurationHours);
        }
    }
}