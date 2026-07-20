package vacademy.io.admin_core_service.features.booking.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;

/** Read DTO for a booked meeting (My Schedule / Team Meetings rows). */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class BookingInstanceDTO {
    private String id;
    private String instituteId;
    private String bookingPageId;
    private String bookingPageTitle; // enriched on read
    private String liveSessionId;
    private String scheduleId;
    private String hostUserId;
    private String hostName; // enriched on read (Team Meetings)
    private String inviteeUserId;
    private String audienceResponseId;
    private String inviteeName;
    private String inviteeEmail;
    private String inviteePhone;
    private String inviteeTimezone;
    private Timestamp scheduledStartUtc;
    private Timestamp scheduledEndUtc;
    private String status;
    private String meetLink;
    private String cancelReason;
    private Timestamp createdAt;
}
