package vacademy.io.admin_core_service.features.live_session.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Date;
import java.sql.Time;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ScheduledSessionDTO {
    private String scheduleId;
    private String sessionId;
    private String title;
    private String subject;
    private Date meetingDate;
    private Time startTime;
    private Time lastEntryTime;
    private String customMeetingLink;
    private String customWaitingRoomMediaId;
    private String defaultMeetLink;
    private String waitingRoomLink;
    private String status;
}
