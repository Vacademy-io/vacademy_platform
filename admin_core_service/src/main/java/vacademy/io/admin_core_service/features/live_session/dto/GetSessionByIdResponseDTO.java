package vacademy.io.admin_core_service.features.live_session.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class GetSessionByIdResponseDTO {
    private String sessionId;
    private String instituteId;
    private String title;
    private String subject;
    private String descriptionHtml;
    private String defaultMeetLink;
    private LocalDateTime startTime;
    private LocalDateTime lastEntryTime;
    private String linkType;
    private String link;
    private String recurrenceType;
    private LocalDate sessionEndDate;
    private List<ScheduleItem> addedSchedules;
    private List<NotificationAction> notificationActions;

    @Getter
    @Setter
    public static class ScheduleItem {
        private String Id;
        private String day;
        private String startTime;
        private String duration;
        private String link;
    }

    @Getter
    @Setter
    public static class NotificationAction {
        private String id;
        private String type;
        private NotifyBy notifyBy;
        private boolean notify;
        private LocalDateTime time;
    }

    @Getter
    @Setter
    public static class NotifyBy {
        private boolean mail;
        private boolean whatsapp;
    }

    @Getter
    @Setter
    static public class NotificationConfigResponse {
        private String sessionId;
        private String accessType;
        private List<String> packageSessionIds;
        private List<String> deletedPackageSessionIds = new ArrayList<>();
        private String joinLink;
        private List<NotificationAction> addedNotificationActions;
        private List<NotificationAction> updatedNotificationActions = new ArrayList<>();
        private List<String> deletedNotificationActionIds = new ArrayList<>();
        private List<Object> addedFields = new ArrayList<>();
        private List<Object> updatedFields = new ArrayList<>();
        private List<String> deletedFieldIds = new ArrayList<>();
    }
}
