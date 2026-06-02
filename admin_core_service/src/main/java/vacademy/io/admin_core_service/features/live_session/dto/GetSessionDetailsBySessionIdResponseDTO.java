package vacademy.io.admin_core_service.features.live_session.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.live_session.dto.GetSessionByIdResponseDTO.LearnerButtonConfigDTO;

import java.sql.Date;
import java.sql.Time;
import java.sql.Timestamp;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GetSessionDetailsBySessionIdResponseDTO {
    private String sessionId;
    private String scheduleId;
    private String instituteId;
    private Timestamp sessionStartTime;
    private Timestamp lastEntryTime;
    private String accessLevel;
    private String meetingType;
    private String linkType;
    private String sessionStreamingServiceType;
    private String defaultMeetLink;
    private String defaultClassLink;
    private String defaultClassName;
    private String defaultClassLinkType;
    private LearnerButtonConfigDTO learnerButtonConfig;
    private String waitingRoomLink;
    private Integer waitingRoomTime;
    private String registrationFormLinkForPublicSessions;
    private String createdByUserId;
    private String title;
    private String descriptionHtml;
    private String notificationEmailMessage;
    private String attendanceEmailMessage;
    private String coverFileId;
    private String subject;
    private String thumbnailFileId;
    // new field added
    private String scheduleThumbnailFileId;
    private Boolean allowPlayPause;

    private String backgroundScoreFileId;
    private String status;
    private String allowRewind;

    private String recurrenceType;
    private String recurrenceKey;
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd", timezone = "UTC")
    private Date meetingDate;
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "HH:mm:ss", timezone = "UTC")
    private Time scheduleStartTime;
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "HH:mm:ss", timezone = "UTC")
    private Time scheduleLastEntryTime;
    private String customMeetingLink;
    private String customWaitingRoomMediaId;
    private String timezone;
    private String providerHostUrl;
    private String providerMeetingId;
}
