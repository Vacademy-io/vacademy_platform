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
    private String joinLink;
    private String recurrenceType;
    private LocalDate sessionEndDate;
    private String accessType;
    private String waitingRoomTime;
    private String thumbnailFileId;
    private String backgroundScoreFileId;
    private String sessionStreamingServiceType;
    private String timezone;
    private List<String> packageSessionIds;
    private List<ScheduleItem> addedSchedules;

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
    public static class Field{
        private String id;
        private String type;
        private String label;
        private Boolean required;
        private Boolean isDefault;
    }

    @Getter
    @Setter
    static public class NotificationConfigResponse {
        private List<NotificationAction> addedNotificationActions;
        private List<Field> addedFields = new ArrayList<>();
    }
}
