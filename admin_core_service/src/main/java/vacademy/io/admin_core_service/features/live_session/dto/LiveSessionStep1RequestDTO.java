package vacademy.io.admin_core_service.features.live_session.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

import java.sql.Timestamp;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class LiveSessionStep1RequestDTO {
    private String sessionId;
    private String instituteId;
    private String title;
    private String subject;
    private String descriptionHtml;
    private String defaultMeetLink;
    private String joinLink;
    private Timestamp startTime;
    private Timestamp lastEntryTime;
    private String sessionEndDate; // Note: fixed casing to `sessionEndDate`
    private String recurrenceType; // e.g., "WEEKLY"
    private String linkType;
    private Integer waitingRoomTime;
    private String thumbnailFileId;
    private String backgroundScoreFileId;
    private String coverFileId;
    private Boolean allowRewind;
    private String sessionStreamingServiceType;

    private boolean allowPlayPause; //new added
    private String timeZone;

    private List<ScheduleDTO> addedSchedules;
    private List<ScheduleDTO> updatedSchedules;
    private List<String> deletedScheduleIds;

    @Data
    @JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
    public static class ScheduleDTO {
        private String id; // required for update only
        private String day;
        private String startTime;
        private String duration;
        private String link;

        //new added field
        private String thumbnailFileId;
        private boolean dailyAttendance;
    }
}
