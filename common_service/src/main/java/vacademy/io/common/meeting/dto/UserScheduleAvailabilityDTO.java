package vacademy.io.common.meeting.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class UserScheduleAvailabilityDTO {

    /** True if the organizer has no overlapping sessions in the requested window. */
    private boolean available;

    /** ISO-8601 start of the requested window. */
    private String requestedStartTime;

    /** Duration of the requested meeting in minutes. */
    private int requestedDurationMinutes;

    /** Sessions that overlap with the requested window. Empty when available=true. */
    private List<ConflictingSessionDTO> conflicts;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ConflictingSessionDTO {
        private String meetingKey;
        private String topic;
        /** Epoch milliseconds */
        private long startTimeMillisec;
        /** Epoch milliseconds */
        private long endTimeMillisec;
    }
}
