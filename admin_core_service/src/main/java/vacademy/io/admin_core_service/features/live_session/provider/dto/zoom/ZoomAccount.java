package vacademy.io.admin_core_service.features.live_session.provider.dto.zoom;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

/**
 * In-memory view of a single Zoom account for an institute.
 *
 * Backed by a row in {@code institute_live_session_provider_mapping}
 * (provider = ZOOM_MEETING); the secret-bearing fields live AES-encrypted inside
 * that row's config_json. This is a plain value object (not a JPA entity) so the
 * downstream token/signature/webhook services can keep using the same getters
 * they used before the storage was consolidated onto the shared provider table.
 *
 * {@code id} is the provider-mapping row id — used as the internal account id in
 * the webhook URL path and pinned onto session_schedules.zoom_account_id.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ZoomAccount {

    private String id;
    private String instituteId;

    private String label;
    private String zoomAccountId;
    private String s2sClientId;
    private String s2sClientSecretEnc;
    private String sdkClientKey;
    private String sdkClientSecretEnc;
    private String webhookVerificationTokenEnc;

    // ── Auth model ───────────────────────────────────────────────────────────
    // "S2S"  → pasted Server-to-Server credentials (s2sClientId/Secret + zoomAccountId).
    // "OAUTH" → connected via "Connect with Zoom" (authorization-code). The SDK key/secret
    //           come from the platform app (zoom.sdk.*), and access tokens are derived from
    //           the rotating refresh token below.
    @Builder.Default
    private String authType = "S2S";

    /** OAuth refresh token (AES-GCM encrypted). Rotates on every refresh — persist the latest. */
    private String oauthRefreshTokenEnc;

    /** The authorizing Zoom user's id (host for meetings created via OAuth; me-only for user-managed apps). */
    private String zoomUserId;

    @Builder.Default
    private String status = "ACTIVE";

    @Builder.Default
    private Boolean isDefault = false;

    private Date lastVerifiedAt;
    private Date createdAt;

    public boolean isDefault() {
        return Boolean.TRUE.equals(isDefault);
    }
}
