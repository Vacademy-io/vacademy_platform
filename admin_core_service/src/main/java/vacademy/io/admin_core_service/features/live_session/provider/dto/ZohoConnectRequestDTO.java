package vacademy.io.admin_core_service.features.live_session.provider.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request body to connect an institute to Zoho Meeting (one-time setup).
 * The admin generates the authorizationCode from Zoho API Console → Self
 * Client.
 *
 * Required scopes when generating the code:
 * ZohoMeeting.meeting.CREATE,ZohoMeeting.meeting.READ,ZohoMeeting.recording.READ,AaaServer.profile.READ
 *
 * If AaaServer.profile.READ is not included, provide zohoUserId manually.
 * Find your Zoho User ID at: https://meeting.zoho.in → Profile → Account ID
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ZohoConnectRequestDTO {
    private String instituteId;
    private String clientId;
    private String clientSecret;
    /**
     * One-time authorization code from Zoho API Console (Self Client → Generate
     * Code).
     * Valid for ~10 minutes.
     */
    private String authorizationCode;
    /**
     * Zoho account domain: "zoho.com" (US/Global), "zoho.in" (India).
     * Defaults to "zoho.com" if null.
     */
    private String domain;
    /**
     * Optional: Your Zoho numeric User ID (e.g. "738461234").
     * If provided, skips the automatic /oauth/user/info fetch.
     * Required only when the auth code was NOT generated with
     * AaaServer.profile.READ scope.
     * Find it at: Zoho Meeting → Avatar/Profile → Account Details → Zoho ID
     */
    private String zohoUserId;
}
