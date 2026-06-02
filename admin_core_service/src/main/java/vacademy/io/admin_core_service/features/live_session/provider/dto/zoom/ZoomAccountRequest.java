package vacademy.io.admin_core_service.features.live_session.provider.dto.zoom;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Inbound payload when an admin adds or updates a Zoom account.
 *
 * Update semantics: secret fields ({@code s2sClientSecret}, {@code sdkClientSecret},
 * {@code webhookVerificationToken}) may be left null on update, in which case the
 * existing encrypted value is preserved. The admin must re-enter a secret to change it
 * — the encrypted form is never returned to the UI, so blank-means-unchanged is the
 * only safe contract.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ZoomAccountRequest {

    @NotBlank
    private String label;

    @NotBlank
    private String zoomAccountId;

    @NotBlank
    private String s2sClientId;

    /** Required on create; optional on update (null = keep existing). */
    private String s2sClientSecret;

    @NotBlank
    private String sdkClientKey;

    /** Required on create; optional on update. */
    private String sdkClientSecret;

    /** Optional — only set when admin has configured webhook subscription in Zoom Marketplace. */
    private String webhookVerificationToken;

    /** If true, this account becomes the institute's default; existing default is unset. */
    private Boolean setAsDefault;
}
