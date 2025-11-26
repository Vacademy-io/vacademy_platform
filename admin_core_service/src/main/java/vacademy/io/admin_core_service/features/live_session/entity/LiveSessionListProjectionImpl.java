package vacademy.io.admin_core_service.features.live_session.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionRepository;

import java.sql.Date;
import java.sql.Time;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LiveSessionListProjectionImpl implements LiveSessionRepository.LiveSessionListProjection {
    private String sessionId;
    private Integer waitingRoomTime;
    private String thumbnailFileId;
    private String backgroundScoreFileId;
    private String sessionStreamingServiceType;
    private String scheduleId;
    private Date meetingDate;
    private Time startTime;
    private Time lastEntryTime;
    private String recurrenceType;
    private String accessLevel;
    private String title;
    private String subject;
    private String registrationFormLinkForPublicSessions;
    private Boolean allowPlayPause;
    private String timezone;
    private String meetingLink;
}

