package vacademy.io.admin_core_service.features.live_session.provider.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request body to connect an institute to a Live Session Provider (e.g. Zoho,
 * Zoom).
 * For OAuth setups, provide clientId, clientSecret, authorizationCode.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ProviderConnectRequestDTO {
    private String instituteId;
    private String clientId;
    private String clientSecret;
    /**
     * One-time authorization code from the provider's OAuth flow.
     */
    private String authorizationCode;
    /**
     * Account domain (if applicable, e.g., zoho.com vs zoho.in).
     */
    private String domain;
    /**
     * Provider-specific user identifier (e.g. Zoho User ID).
     */
    private String vendorUserId;
}
