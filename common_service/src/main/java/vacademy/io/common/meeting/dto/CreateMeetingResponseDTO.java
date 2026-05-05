package vacademy.io.common.meeting.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.common.meeting.enums.MeetingProvider;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class CreateMeetingResponseDTO {
    private String providerMeetingId;
    private String joinUrl;
    private String hostUrl;
    private MeetingProvider provider;
    /** Full raw JSON response from the provider for debugging / future use */
    private Map<String, Object> rawResponse;

    /**
     * True when this DTO represents a meeting that was created by the current
     * call (vs. fetched because it already existed). Callers use this to skip
     * post-create checks like isMeetingRunning that would otherwise spuriously
     * report "ended" before any participant has joined.
     */
    private boolean justCreated;
}
