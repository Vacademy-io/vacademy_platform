package vacademy.io.admin_core_service.features.live_session.provider.dto.zoom;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Everything a Capacitor (iOS/Android) learner needs to join a Zoom meeting
 * outside the embedded SDK: a {@code zoommtg://} deep link that opens the Zoom
 * app straight into the meeting, plus a web-client fallback URL for when the app
 * isn't installed.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ZoomJoinPayloadResponse {

    private String meetingNumber;
    private String passcode;
    private String userName;
    /** zoommtg:// deep link with meeting number, passcode and display name prefilled. */
    private String deepLink;
    /** Zoom web-client URL to open in the in-app browser if the Zoom app is absent. */
    private String webFallback;
}
