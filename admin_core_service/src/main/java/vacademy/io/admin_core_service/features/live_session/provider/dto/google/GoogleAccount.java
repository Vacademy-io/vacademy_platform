package vacademy.io.admin_core_service.features.live_session.provider.dto.google;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

/**
 * In-memory view of a single connected Google Workspace account for an institute.
 *
 * Backed by a row in {@code institute_live_session_provider_mapping}
 * (provider = GOOGLE_MEET); the OAuth refresh token lives AES-encrypted inside that
 * row's config_json. Plain value object (not a JPA entity) — mirrors {@code ZoomAccount}.
 *
 * {@code id} is the provider-mapping row id — the internal account id pinned onto
 * session_schedules.provider_account_id. {@code organizerEmail} doubles as the
 * vendor_user_id natural key (per-institute dedup).
 *
 * Unlike Zoom there is only one auth model: per-tenant authorization-code OAuth against
 * the one shared Google Cloud app. Google refresh tokens are long-lived and do NOT rotate
 * on every refresh, so {@code oauthRefreshTokenEnc} is persisted once at connect time.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GoogleAccount {

    private String id;
    private String instituteId;

    private String label;

    /** The connected (designated organizer) Google account email. Also = vendor_user_id. */
    private String organizerEmail;

    /** OAuth refresh token (AES-GCM encrypted). Long-lived; only re-set on reconnect. */
    private String oauthRefreshTokenEnc;

    /** Space-separated list of granted OAuth scopes (audit / capability check). */
    private String grantedScopes;

    /**
     * Whether this institute is on a recording-capable Workspace edition and wants
     * auto-recording. Defaults false — recording only works on Business Standard+/
     * Education Plus/Enterprise (admin asserts the edition; no API to read it).
     */
    @Builder.Default
    private Boolean recordingEnabled = false;

    /**
     * Default Meet space access mode for meetings created on this account.
     * OPEN | TRUSTED | RESTRICTED. Defaults OPEN so anonymous URL-join learners get in WITHOUT
     * knocking — the entire learner product joins by opening the shared meetingUri, and TRUSTED
     * would force a host to manually admit every external learner. The link is gated by Vacademy
     * enrolment and a fresh per-occurrence space bounds any leak. Admins can switch an account to
     * TRUSTED (host admits each external guest) under Settings → Google Meet Integration.
     */
    @Builder.Default
    private String defaultAccessType = "OPEN";

    /** Optional default timezone for meetings (display only). */
    private String defaultTimezone;

    /** ACTIVE | RECONNECT_NEEDED — flips to RECONNECT_NEEDED on invalid_grant at refresh. */
    @Builder.Default
    private String status = "ACTIVE";

    @Builder.Default
    private Boolean isDefault = false;

    private Date lastVerifiedAt;
    private Date createdAt;

    public boolean isDefault() {
        return Boolean.TRUE.equals(isDefault);
    }

    public boolean isRecordingEnabled() {
        return Boolean.TRUE.equals(recordingEnabled);
    }
}
