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
