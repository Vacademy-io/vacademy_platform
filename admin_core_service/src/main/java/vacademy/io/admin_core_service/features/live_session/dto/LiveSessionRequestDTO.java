package vacademy.io.admin_core_service.features.live_session.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class LiveSessionRequestDTO {
    private String id;
    private LocalDateTime startTime;
    private LocalDateTime lastEntryTime;

    private String access; // "public" or "private"
    private String meetingType; // "recurring" or "once"
    private String recurringType; // "weekly" or "monthly"
    private String recurringWeeksOrMonths; // "1,2" for 1st and 2nd week/month

    // For weekly recurring
    private List<String> weekDays; // e.g., ["MONDAY", "WEDNESDAY"]
    private Map<String, String> timingPerDay; // e.g., { "MONDAY": "09:00-10:00" }

    // For monthly recurring
    private List<Integer> monthlyDates; // e.g., [1, 15, 28]
    private Map<Integer, String> timingPerDate; // e.g., { 1: "09:00-10:00", 15: "14:00-15:00" }

    private String defaultMeetLink;
    private String createdByUserId;

    private String title;
    private String descriptionHtml;
    private String notificationEmailMessage;
    private String attendanceEmailMessage;
    private String coverFileId;
}

