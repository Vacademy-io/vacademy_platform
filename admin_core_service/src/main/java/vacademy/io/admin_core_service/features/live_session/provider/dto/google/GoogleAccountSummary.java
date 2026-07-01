package vacademy.io.admin_core_service.features.live_session.provider.dto.google;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

/**
 * Outbound shape returned by all Google account read endpoints.
 *
 * The OAuth refresh token is NEVER returned. The organizer email IS shown (unmasked) —
 * the admin needs to see which Google account is connected; it's not a secret.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class GoogleAccountSummary {

    private String id;
    private String label;
    private String organizerEmail;
    /** ACTIVE | RECONNECT_NEEDED */
    private String status;
    private Boolean isDefault;
    private Boolean recordingEnabled;
    private String defaultAccessType;
    private String defaultTimezone;
    private Date lastVerifiedAt;
    private Date createdAt;
}
