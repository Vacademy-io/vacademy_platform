package vacademy.io.admin_core_service.features.live_session.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Time;
import java.util.Date;
import java.util.List;

/**
 * A single past live-class occurrence in the learner's history, per
 * docs/LIVE_CLASS_PAST_SESSIONS_AND_CONTENT_LINKING_PLAN.md section A2.
 *
 * Unlike {@link LiveSessionListDTO}, meeting_date/start_time are serialized as
 * plain ISO strings (no Asia/Kolkata reinterpretation quirk) — the learner FE
 * formats them client-side using {@code timezone}.
 *
 * {@code recordings}, {@code attendanceStatus}, and {@code activity} are only
 * populated when the corresponding institute-governed display flag is on;
 * they are omitted (not merely null) from the JSON response via
 * {@code NON_NULL} inclusion so the payload carries no data the admin has not
 * opted into exposing.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LearnerPastSessionDTO {

    private String sessionId;
    private String scheduleId;
    private String title;
    private String subject;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd", timezone = "UTC")
    private Date meetingDate;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "HH:mm:ss", timezone = "UTC")
    private Time startTime;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "HH:mm:ss", timezone = "UTC")
    private Time lastEntryTime;

    private String timezone;
    private String linkType;
    private String thumbnailFileId;

    /** Only present when display_flags.show_recordings is true. */
    private List<LearnerRecordingDTO> recordings;

    /** PRESENT | ABSENT | UNMARKED — only present when display_flags.show_attendance is true. */
    private String attendanceStatus;

    /** Only present when display_flags.show_activity_stats is true. */
    private ActivityDTO activity;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ActivityDTO {
        private Integer durationMinutes;
        private Integer chats;
        private Integer talks;
        private Integer talkTime;
        private Integer raiseHand;
        private Integer emojis;
        private Integer pollVotes;
    }
}
