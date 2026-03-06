package vacademy.io.admin_core_service.features.live_session.provider.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request body for creating a provider meeting tied to a live session schedule.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ProviderMeetingCreateRequestDTO {
    private String instituteId;
    private String sessionId;
    private String scheduleId;
    private String topic;
    private String agenda;
    /** ISO-8601 datetime e.g. "2026-03-05T10:00:00+05:30" */
    private String startTime;
    private int durationMinutes;
    private String timezone;
    private String hostEmail;
    /**
     * Provider to use. If null, defaults to the institute's connected provider.
     * e.g. "ZOHO_MEETING"
     */
    private String provider;
}
