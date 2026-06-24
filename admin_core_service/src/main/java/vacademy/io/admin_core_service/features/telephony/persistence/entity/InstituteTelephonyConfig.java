package vacademy.io.admin_core_service.features.telephony.persistence.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

/**
 * Per-institute provider configuration. One row per institute (UNIQUE on
 * institute_id). Provider-neutral columns — the api_username / api_password /
 * api_account_id triplet maps to whatever the provider calls its credentials.
 */
@Entity
@Table(name = "institute_telephony_config")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InstituteTelephonyConfig {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "institute_id", nullable = false, unique = true)
    private String instituteId;

    @Column(name = "provider_type", nullable = false, length = 32)
    private String providerType;

    // The legacy Exotel HTTP-Basic triplet. No longer mandatory (see V339):
    // providers using the generic provider_secrets_enc model leave these null.
    @Column(name = "api_account_id", length = 128)
    private String apiAccountId;

    @ToString.Exclude
    @Column(name = "api_username_enc", columnDefinition = "TEXT")
    private String apiUsernameEnc;

    @ToString.Exclude
    @Column(name = "api_password_enc", columnDefinition = "TEXT")
    private String apiPasswordEnc;

    /**
     * Generic, provider-agnostic credentials (see V339). A single AES-256-GCM
     * encrypted JSON blob {@code {key -> value}} of whatever secret fields the
     * provider's adapter declares in its {@code credentialSchema()}
     * (consumerKey/consumerSecret/password/…). Null for legacy Exotel rows,
     * which still use the triplet above.
     */
    @ToString.Exclude
    @Column(name = "provider_secrets_enc", columnDefinition = "TEXT")
    private String providerSecretsEnc;

    /**
     * Non-secret provider config as JSON {@code {key -> value}} (region,
     * base_url, token_url, account_id, application_id, …). Plaintext — rendered
     * back by the admin UI.
     */
    @Column(name = "provider_config", columnDefinition = "TEXT")
    private String providerConfig;

    /** Auth scheme: BASIC (Exotel) | OAUTH2_PASSWORD (Vonage/Airtel) | … */
    @Column(name = "auth_type", length = 32)
    private String authType;

    /**
     * Encrypted shared-secret token used to authenticate inbound Exotel
     * StatusCallback POSTs. Nullable — when null, the webhook handler accepts
     * all callbacks for this institute's calls (matched solely by our own
     * correlation id). Useful for dev / sandboxed setups where managing a
     * shared secret is friction; production callers should set it.
     */
    @ToString.Exclude
    @Column(name = "webhook_token_enc", columnDefinition = "TEXT")
    private String webhookTokenEnc;

    @Column(name = "record_calls", nullable = false)
    @Builder.Default
    private Boolean recordCalls = true;

    @Column(name = "default_selector_key", nullable = false, length = 32)
    @Builder.Default
    private String defaultSelectorKey = "STICKY_PER_LEAD";

    @Column(name = "enabled", nullable = false)
    @Builder.Default
    private Boolean enabled = true;

    /**
     * Optional fallback number dialled as the last leg of the inbound routing
     * waterfall when no counsellor is reachable. Null = no fallback dial; the
     * Connect applet returns an empty number list and the call drops to the
     * provider's default "no agents available" handling. We still log a
     * missed-call timeline event either way.
     */
    @Column(name = "inbound_voicemail_number", length = 32)
    private String inboundVoicemailNumber;

    /**
     * App Bazaar flow id (the alphanumeric trailing part of the App Bazaar
     * editor URL — Exotel sometimes calls it the AppSid, the dashboard just
     * shows it as the flow id). When set, every new/edited ExoPhone is
     * auto-attached to this flow via {@code PUT /IncomingPhoneNumbers/<sid>}
     * so the admin never has to click into the Exotel dashboard again.
     *
     * The flow itself must be created in App Bazaar once — Exotel does not
     * expose flow creation via API. The UI walks the admin through that one-
     * time step with the Connect-applet URL pre-filled.
     */
    @Column(name = "flow_sid", length = 64)
    private String flowSid;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;
}
