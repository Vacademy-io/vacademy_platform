package vacademy.io.admin_core_service.features.live_session.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class BookingDetailDTO {
    // Session Info
    private String sessionId;
    private String title;
    private String subject;
    private String descriptionHtml;
    private String status;
    private String accessLevel;
    private String timezone;

    // Booking Type Info
    private String bookingTypeId;
    private String bookingTypeName;
    private String bookingTypeCode;

    // Source Info
    private String source;
    private String sourceId;

    // Schedule Info
    private String scheduleId;
    private LocalDate meetingDate;
    private LocalTime startTime;
    private LocalTime endTime;
    private String meetingLink;

    // Participants
    private List<ParticipantInfo> participants;

    // Metadata
    private String createdByUserId;
    private String createdAt;
    private String updatedAt;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class ParticipantInfo {
        private String id;
        private String sourceType; // USER or BATCH
        private String sourceId;
        private String name; // Resolved name if available
        private String email; // Resolved email if available
    }
}
