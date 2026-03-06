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
}
