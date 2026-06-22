package vacademy.io.admin_core_service.features.telephony.controller.dto;

import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * Inbound shape for PUT /v1/telephony/config/{instituteId}. The plaintext
 * username/password/webhookToken arrive here and are encrypted before
 * persistence. Outbound shape (GET) omits the secrets entirely.
 *
 * <p>Two credential styles are accepted, depending on the provider:
 * <ul>
 *   <li><b>Legacy Exotel</b>: apiAccountId / apiUsername / apiPassword /
 *       webhookToken (unchanged — the Exotel save path is untouched).</li>
 *   <li><b>Generic</b> (Airtel/Vonage and future providers): {@code authType}
 *       + a {@code secrets} map (plaintext on the wire, stored encrypted as one
 *       blob) + a non-secret {@code config} map, whose keys come from the
 *       provider's {@code credentialSchema()}. Per-key blank = leave unchanged
 *       on update, so secrets aren't wiped by re-saving the form.</li>
 * </ul>
 */
@Data
@NoArgsConstructor
public class TelephonyConfigDTO {
    private String providerType;       // e.g. EXOTEL / AIRTEL
    private String apiAccountId;       // Exotel Account SID (legacy)
    private String apiUsername;        // plaintext on the wire, encrypted at rest (legacy)
    private String apiPassword;        // plaintext on the wire, encrypted at rest (legacy)
    private String webhookToken;       // plaintext on the wire, encrypted at rest

    /** Generic auth scheme: BASIC | OAUTH2_PASSWORD | … (provider-declared). */
    private String authType;
    /** Generic secret fields (plaintext on wire). Stored encrypted as one blob. */
    private Map<String, String> secrets;
    /** Generic non-secret config fields (region, base_url, token_url, …). */
    private Map<String, String> config;

    private Boolean recordCalls;
    private String defaultSelectorKey; // STICKY_PER_LEAD / ROUND_ROBIN / REGION_MATCH
    private Boolean enabled;
    /**
     * Optional E.164 fallback number for lead callbacks when no counsellor is
     * reachable. Null/blank = no fallback dial. Saved as-is (no encryption).
     */
    private String inboundVoicemailNumber;
    /**
     * App Bazaar flow id used to auto-attach every new ExoPhone via Exotel's
     * IncomingPhoneNumbers API. Admin pastes this once after creating the
     * flow in App Bazaar (the UI walks them through it). Empty/null disables
     * auto-attach — numbers get added but their inbound routing is left to
     * whatever the admin set manually in the dashboard.
     */
    private String flowSid;
}
