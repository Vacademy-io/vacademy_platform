package vacademy.io.admin_core_service.features.telephony.controller.dto;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Inbound shape for PUT /v1/telephony/config/{instituteId}. The plaintext
 * username/password/webhookToken arrive here and are encrypted before
 * persistence. Outbound shape (GET) omits the secrets entirely.
 */
@Data
@NoArgsConstructor
public class TelephonyConfigDTO {
    private String providerType;       // e.g. EXOTEL
    private String apiAccountId;       // Exotel Account SID
    private String apiUsername;        // plaintext on the wire, encrypted at rest
    private String apiPassword;        // plaintext on the wire, encrypted at rest
    private String webhookToken;       // plaintext on the wire, encrypted at rest
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
