package vacademy.io.admin_core_service.features.live_session.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class LiveSessionStep1RequestDTO {
    private String title;
    private String subject;
    private String descriptionHtml;
    private String defaultMeetLink;
    private Timestamp startTime;
    private Timestamp lastEntryTime;
    private String SessionEndDate; // last session date or the session will not be scheduled after this date
    private String linkType;
    private String link;
    private String recurrenceType; // e.g., "weekly"
    private List<WeeklyDetailsDTO> recurringWeeklySchedule;
}
