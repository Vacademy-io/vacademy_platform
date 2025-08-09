package vacademy.io.notification_service.features.announcements.dto;

import lombok.Data;
import vacademy.io.notification_service.features.announcements.enums.AnnouncementStatus;
import vacademy.io.notification_service.features.announcements.enums.ScheduleType;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class AnnouncementCalendarItem {
    private String announcementId;
    private String title;
    private AnnouncementStatus status;
    private String instituteId;
    private String createdByRole;

    // Mode summary for quick UI badges
    private List<String> modeTypes;

    // Scheduling info (if any)
    private ScheduleType scheduleType;
    private LocalDateTime startDate;
    private LocalDateTime endDate;
    private LocalDateTime nextRunTime;
    private LocalDateTime lastRunTime;

    // Timestamps for immediate deliveries
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}


