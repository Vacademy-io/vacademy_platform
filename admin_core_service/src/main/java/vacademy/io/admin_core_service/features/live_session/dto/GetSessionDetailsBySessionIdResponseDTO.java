package vacademy.io.admin_core_service.features.live_session.dto;


import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

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
    //new field added
    private String scheduleThumbnailFileId;
    private Boolean allowPlayPause;

    private String backgroundScoreFileId;
    private String status;
    private String allowRewind;

    private String recurrenceType;
    private String recurrenceKey;
    private Date meetingDate;
    private Time scheduleStartTime;
    private Time scheduleLastEntryTime;
    private String customMeetingLink;
    private String customWaitingRoomMediaId;
}

