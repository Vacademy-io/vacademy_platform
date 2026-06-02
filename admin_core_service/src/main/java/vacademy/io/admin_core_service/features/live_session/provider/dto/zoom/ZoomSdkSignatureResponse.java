package vacademy.io.admin_core_service.features.live_session.provider.dto.zoom;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Everything the Zoom Web Meeting SDK needs to join a meeting seamlessly —
 * returned to the learner dashboard so it can call client.join() without
 * prompting for name or passcode.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ZoomSdkSignatureResponse {

    private String signature;
    private String sdkKey;
    private String meetingNumber;
    private String passcode;
    private String userName;
    private String userEmail;
    /** 0 = participant, 1 = host. */
    private int role;
    /** Host-start token — populated only when role = 1. */
    private String zakToken;
    /** Unix epoch seconds when the signature expires (frontend refreshes near this). */
    private long tokenExp;
}
