package vacademy.io.admin_core_service.features.live_session.dto;


import java.sql.Time;
import java.util.Date;

public class LIveSessionDTO {
    private String sessionId;
    private String title;
    private String subject;
    private String accessLevel;
    private String status;
    private Date meetingDate;
    private Time startTime;
    private Time lastEntryTime;
    private String customMeetingLink;

    // Constructor
    public LIveSessionDTO(String sessionId, String title, String subject , String accessLevel, Date meetingDate,
                                  Time startTime, Time lastEntryTime, String customMeetingLink) {
        this.sessionId = sessionId;
        this.title = title;
        this.subject = subject;
        this.accessLevel = accessLevel;
        this.meetingDate = meetingDate;
        this.startTime = startTime;
        this.lastEntryTime = lastEntryTime;
        this.customMeetingLink = customMeetingLink;
    }

    // Getters (no setters needed if you're only reading)
}

