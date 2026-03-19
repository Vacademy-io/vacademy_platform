package vacademy.io.common.meeting.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class MeetingAttendeeDTO {
    private String name;
    private String email;
    /** ISO-8601 */
    private String joinTime;
    /** ISO-8601 */
    private String leaveTime;
    private int durationMinutes;
}
