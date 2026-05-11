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
    private String defaultClassLink;
    private String defaultClassName;
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

    private boolean allowPlayPause; // new added
    private String timeZone;

    private String bookingTypeId;
    private String source;
    private String sourceId;

    private List<ScheduleDTO> addedSchedules;
    private List<ScheduleDTO> updatedSchedules;
    private List<String> deletedScheduleIds;

    private LearnerButtonConfigDTO learnerButtonConfig;

    private BbbConfigDTO bbbConfig;

    private FeedbackConfigDTO feedbackConfig;

    @Data
    @JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
    public static class FeedbackConfigDTO {
        private Boolean enabled;
        // When false, learners cannot dismiss the feedback form and must answer
        // every enabled+mandatory question. Null/true preserves the previous
        // skip-allowed behavior so existing sessions are unaffected.
        private Boolean allowSkip;
        private java.util.List<FeedbackQuestionDTO> questions;
    }

    @Data
    @JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
    public static class FeedbackQuestionDTO {
        private String id;
        private String type;       // "star_rating" or "free_text"
        private String label;
        private Boolean enabled;
        private Boolean mandatory;
        private Integer maxStars;  // only for star_rating
        private Boolean allowHalf; // only for star_rating
    }

    @Data
    @JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
    public static class BbbConfigDTO {
        private Boolean record;
        private Boolean autoStartRecording;
        private Boolean muteOnStart;
        private Boolean webcamsOnlyForModerator;
        private String guestPolicy;
    }

    @Data
    @JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
    public static class ScheduleDTO {
        private String id; // required for update only
        private String day;
        private String startTime;
        private String duration;
        private String link;

        // new added field
        private String thumbnailFileId;
        private boolean dailyAttendance;
        private String defaultClassLink;
        private String defaultClassName;
        private LearnerButtonConfigDTO learnerButtonConfig;
    }

    @Data
    @JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
    public static class LearnerButtonConfigDTO {
        private boolean isVisible;
        private String text;
        private String url;
        private String backgroundColor;
        private String textColor;
    }
}
