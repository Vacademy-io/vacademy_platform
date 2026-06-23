package vacademy.io.admin_core_service.features.telephony.controller.dto;

import lombok.Builder;
import lombok.Data;
import vacademy.io.admin_core_service.features.telephony.core.TelephonyJson;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.InstituteTelephonyConfig;

import java.sql.Timestamp;
import java.util.Map;

/** GET-side projection. Never exposes secrets. */
@Data
@Builder
public class TelephonyConfigViewDTO {
    private String id;
    private String instituteId;
    private String providerType;
    private String apiAccountId;
    private boolean apiUsernameSet;    // true if a credential is stored, false if blank
    private boolean apiPasswordSet;
    private boolean webhookTokenSet;
    /** Generic auth scheme (BASIC | OAUTH2_PASSWORD | …). */
    private String authType;
    /** Non-secret provider config, echoed back verbatim (region, base_url, …). */
    private Map<String, String> config;
    /** True if a generic encrypted secrets blob is stored (secrets never echoed). */
    private boolean providerSecretsSet;
    private Boolean recordCalls;
    private String defaultSelectorKey;
    private Boolean enabled;
    /** Inbound fallback number (E.164). Echoed back as-is — no encryption. */
    private String inboundVoicemailNumber;
    /** App Bazaar flow id (drives Exotel auto-attach on number CRUD). */
    private String flowSid;
    /**
     * Public base URL the provider should hit for webhooks/route calls.
     * Sourced from {@code telephony.webhook.callback-base} on the server — the
     * Setup Guide renders the full Connect-applet URL by appending the route
     * path + token. Not persisted; injected by the controller at GET time.
     */
    private String webhookCallbackBase;
    private Timestamp updatedAt;

    public static TelephonyConfigViewDTO from(InstituteTelephonyConfig c) {
        return TelephonyConfigViewDTO.builder()
                .id(c.getId())
                .instituteId(c.getInstituteId())
                .providerType(c.getProviderType())
                .apiAccountId(c.getApiAccountId())
                .apiUsernameSet(c.getApiUsernameEnc() != null && !c.getApiUsernameEnc().isBlank())
                .apiPasswordSet(c.getApiPasswordEnc() != null && !c.getApiPasswordEnc().isBlank())
                .webhookTokenSet(c.getWebhookTokenEnc() != null && !c.getWebhookTokenEnc().isBlank())
                .authType(c.getAuthType())
                .config(TelephonyJson.read(c.getProviderConfig()))
                .providerSecretsSet(c.getProviderSecretsEnc() != null && !c.getProviderSecretsEnc().isBlank())
                .recordCalls(c.getRecordCalls())
                .defaultSelectorKey(c.getDefaultSelectorKey())
                .enabled(c.getEnabled())
                .inboundVoicemailNumber(c.getInboundVoicemailNumber())
                .flowSid(c.getFlowSid())
                .updatedAt(c.getUpdatedAt())
                .build();
    }
}
