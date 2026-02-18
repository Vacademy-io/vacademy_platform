package vacademy.io.admin_core_service.features.live_session.dto;


import java.time.*;

public interface ScheduleDTO {
    String getScheduleId();
    String getSessionId();
    LocalDate getMeetingDate();
    LocalTime getScheduleStartTime();
    LocalTime getScheduleLastEntryTime();
    String getSessionTitle();
    String getSubject();
    LocalDateTime getSessionStartTime();
    String getAccessType();
    String getSessionStatus();
    String getInstituteId();
    LocalDateTime getLastEntryTime();
    String getAccessLevel();
    String getMeetingType();
    String getLinkType();
    String getSessionStreamingServiceType();
    String getDefaultMeetLink();
    String getDefaultClassLink();
    String getDefaultClassLinkType();
    String getDefaultClassName();
    String getLearnerButtonConfig();
    String getWaitingRoomLink();
    Integer getWaitingRoomTime();
    String getRegistrationFormLinkForPublicSessions();
    String getCreatedByUserId();
    String getTitle();
    String getDescriptionHtml();
    String getNotificationEmailMessage();
    String getAttendanceEmailMessage();
    String getCoverFileId();
    String getThumbnailFileId();
    String getBackgroundScoreFileId();
    String getStatus();

    String getRecurrenceType();
    String getRecurrenceKey();
    String getCustomMeetingLink();
    String getCustomWaitingRoomMediaId();
    String getTimezone();
    Boolean getAllowRewind();
    Boolean getAllowPlayPause();
}
