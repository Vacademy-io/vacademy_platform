package vacademy.io.admin_core_service.features.live_session.provider.dto.zoom;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

/**
 * Outbound shape returned by all Zoom account read endpoints.
 *
 * Secrets are NEVER returned. The {@code zoomAccountIdMasked} field shows only the
 * first 4 and last 4 chars so the admin can identify which Zoom account a row maps
 * to without exposing the full identifier in browser/network logs.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ZoomAccountSummary {

    private String id;
    private String label;
    private String zoomAccountIdMasked;
    private String s2sClientIdMasked;
    private String sdkClientKeyMasked;
    private Boolean webhookConfigured;
    private String status;
    private Boolean isDefault;
    private Date lastVerifiedAt;
    private Date createdAt;
}
