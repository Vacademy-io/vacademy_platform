package vacademy.io.admin_core_service.features.live_session.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CheckAvailabilityRequest {
    private String instituteId;

    // Check availability for these users
    private List<String> userIds;

    // Check availability for resources (using source/sourceId pattern)
    private String source; // e.g., "ROOM", "EQUIPMENT"
    private String sourceId; // e.g., "ROOM_123"

    // Date range to check
    private LocalDate startDate;
    private LocalDate endDate;

    // Optional: specific time range within each day
    private LocalTime startTime;
    private LocalTime endTime;

    // Optional: duration in minutes (for slot-based availability)
    private Integer durationMinutes;

    // Optional: exclude this session (for reschedule scenarios)
    private String excludeSessionId;
}
