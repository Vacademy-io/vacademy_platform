package vacademy.io.common.meeting.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class CreateMeetingRequestDTO {
    private String topic;
    private String agenda;
    /** ISO-8601 datetime string e.g. "2026-03-05T10:00:00+05:30" */
    private String startTime;
    private int durationMinutes;
    private String timezone;
    private String hostEmail;
    /** Vacademy live_session id — used to link the provider meeting back */
    private String sessionId;
    /** Vacademy session_schedule id — used to link the provider meeting back */
    private String scheduleId;
    /** BBB-specific meeting config (record, muteOnStart, webcamsOnlyForModerator, guestPolicy) */
    private Map<String, Object> bbbConfig;
}
