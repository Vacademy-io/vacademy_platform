package vacademy.io.notification_service.features.announcements.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;
import vacademy.io.notification_service.features.announcements.enums.TaskStatus;

import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "announcement_tasks")
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class AnnouncementTask {
    @UuidGenerator
    @Id
    private String id;
    
    @Column(name = "announcement_id", nullable = false)
    private String announcementId;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "announcement_id", insertable = false, updatable = false)
    private Announcement announcement;
    
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "slide_ids", nullable = false)
    private List<String> slideIds; // Array of slide IDs associated with this task
    
    @Column(name = "go_live_datetime", nullable = false)
    private LocalDateTime goLiveDateTime; // When the task becomes available/active
    
    @Column(name = "deadline_datetime", nullable = false)
    private LocalDateTime deadlineDateTime; // When the task must be completed by
    
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private TaskStatus status = TaskStatus.DRAFT;
    
    @Column(name = "task_title", length = 255)
    private String taskTitle; // Optional title for the task (can be different from announcement title)
    
    @Column(name = "task_description", length = 1000)
    private String taskDescription; // Optional description specific to the task
    
    @Column(name = "estimated_duration_minutes")
    private Integer estimatedDurationMinutes; // How long the task is expected to take
    
    @Column(name = "max_attempts")
    private Integer maxAttempts; // Maximum number of attempts allowed (null = unlimited)
    
    @Column(name = "is_mandatory", nullable = false)
    private Boolean isMandatory = true; // Whether the task is mandatory or optional
    
    @Column(name = "auto_status_update", nullable = false)
    private Boolean autoStatusUpdate = true; // Whether to auto-update status based on datetime
    
    @Column(name = "reminder_before_minutes")
    private Integer reminderBeforeMinutes; // Send reminder X minutes before deadline
    
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;
    
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}