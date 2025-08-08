package vacademy.io.notification_service.features.announcements.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.notification_service.features.announcements.enums.ScheduleType;

import java.time.LocalDateTime;

@Entity
@Table(name = "scheduled_messages")
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class ScheduledMessage {
    @UuidGenerator
    @Id
    private String id;
    
    @Column(name = "announcement_id", nullable = false)
    private String announcementId;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "announcement_id", insertable = false, updatable = false)
    private Announcement announcement;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "schedule_type", nullable = false)
    private ScheduleType scheduleType;
    
    @Column(name = "cron_expression")
    private String cronExpression;
    
    @Column(nullable = false)
    private String timezone = "UTC";
    
    @Column(name = "start_date")
    private LocalDateTime startDate;
    
    @Column(name = "end_date")
    private LocalDateTime endDate;
    
    @Column(name = "next_run_time")
    private LocalDateTime nextRunTime;
    
    @Column(name = "last_run_time")
    private LocalDateTime lastRunTime;
    
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;
    
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
    
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}