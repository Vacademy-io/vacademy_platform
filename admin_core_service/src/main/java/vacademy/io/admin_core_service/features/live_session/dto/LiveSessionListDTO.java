package vacademy.io.admin_core_service.features.live_session.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.sql.Time;
import java.sql.Date;


@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class LiveSessionListDTO {
    private String sessionId;
    private String scheduleId;
    private Date meetingDate;
    private Time startTime;
    private Time lastEntryTime;
    private String recurrenceType;
    private String accessLevel;
    private String title;
    private String subject;
    private String meetingLink;

    // Getters and Setters
}
