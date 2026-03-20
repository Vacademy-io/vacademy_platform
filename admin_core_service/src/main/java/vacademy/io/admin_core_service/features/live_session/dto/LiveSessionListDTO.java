package vacademy.io.admin_core_service.features.live_session.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.sql.Time;
import java.sql.Date;
import java.util.List;

@Data
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
public class LiveSessionListDTO {
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
    private String meetingLink;
    private String registrationFormLinkForPublicSessions;
    private String timezone;
    private LiveSessionStep1RequestDTO.LearnerButtonConfigDTO learnerButtonConfig;
    private String defaultClassLink;
    private String defaultClassName;
    private String linkType;
    private List<PackageSessionInfo> packageSessionDetails;

    public LiveSessionListDTO(String sessionId, Integer waitingRoomTime, String thumbnailFileId,
            String backgroundScoreFileId, String sessionStreamingServiceType, String scheduleId,
            Date meetingDate, Time startTime, Time lastEntryTime, String recurrenceType,
            String accessLevel, String title, String subject, String meetingLink,
            String registrationFormLinkForPublicSessions, String timezone,
            LiveSessionStep1RequestDTO.LearnerButtonConfigDTO learnerButtonConfig,
            String defaultClassLink, String defaultClassName, String linkType) {
        this.sessionId = sessionId;
        this.waitingRoomTime = waitingRoomTime;
        this.thumbnailFileId = thumbnailFileId;
        this.backgroundScoreFileId = backgroundScoreFileId;
        this.sessionStreamingServiceType = sessionStreamingServiceType;
        this.scheduleId = scheduleId;
        this.meetingDate = meetingDate;
        this.startTime = startTime;
        this.lastEntryTime = lastEntryTime;
        this.recurrenceType = recurrenceType;
        this.accessLevel = accessLevel;
        this.title = title;
        this.subject = subject;
        this.meetingLink = meetingLink;
        this.registrationFormLinkForPublicSessions = registrationFormLinkForPublicSessions;
        this.timezone = timezone;
        this.learnerButtonConfig = learnerButtonConfig;
        this.defaultClassLink = defaultClassLink;
        this.defaultClassName = defaultClassName;
        this.linkType = linkType;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
    public static class PackageSessionInfo {
        private String packageSessionId;
        private String packageName;
        private String levelName;
        private String sessionName;
    }
}
