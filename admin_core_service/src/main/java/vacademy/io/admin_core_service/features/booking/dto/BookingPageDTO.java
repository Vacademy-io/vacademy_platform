package vacademy.io.admin_core_service.features.booking.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;

/** Admin-facing create/update/read DTO for a booking page. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class BookingPageDTO {
    private String id;
    private String instituteId;
    private String audienceId;
    private String hostUserId;
    private String hostName; // enriched on read
    private String bookingTypeId;
    private String slug;
    private String title;
    private String description;
    private Integer durationMinutes;
    private Integer slotGranularityMinutes;
    private Integer bufferBeforeMinutes;
    private Integer bufferAfterMinutes;
    private Integer minNoticeMinutes;
    private Integer bookingHorizonDays;
    private String timezone;
    private String locationType;
    private String customMeetingLink;
    private Boolean allocateGoogleMeet;
    private Boolean requireApproval;
    private BookingAvailabilityDTO availability;
    private BookingReminderConfigDTO reminderConfig;
    private String status;
    private String createdByUserId;
    private Timestamp createdAt;
    private Timestamp updatedAt;
}
