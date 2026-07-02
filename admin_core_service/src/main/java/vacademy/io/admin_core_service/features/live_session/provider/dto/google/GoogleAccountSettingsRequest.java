package vacademy.io.admin_core_service.features.live_session.provider.dto.google;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Inbound payload for updating a connected Google account's settings.
 *
 * The account itself is created via the OAuth "Connect Google Workspace" flow, not by
 * pasting credentials, so there are no secret fields here — only the institute-tunable
 * knobs. All fields optional; null = leave unchanged.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GoogleAccountSettingsRequest {

    private String label;

    /** Turn auto-recording on/off. Only meaningful on a recording-capable Workspace edition. */
    private Boolean recordingEnabled;

    /** OPEN | TRUSTED | RESTRICTED — default Meet space access mode for new meetings. */
    private String defaultAccessType;

    private String defaultTimezone;

    /** If true, this account becomes the institute's default; the existing default is unset. */
    private Boolean setAsDefault;
}
