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

    @Column(name = "api_account_id", nullable = false, length = 128)
    private String apiAccountId;

    @Column(name = "api_username_enc", nullable = false, columnDefinition = "TEXT")
    private String apiUsernameEnc;

    @Column(name = "api_password_enc", nullable = false, columnDefinition = "TEXT")
    private String apiPasswordEnc;

    /**
     * Encrypted shared-secret token used to authenticate inbound Exotel
     * StatusCallback POSTs. Nullable — when null, the webhook handler accepts
     * all callbacks for this institute's calls (matched solely by our own
     * correlation id). Useful for dev / sandboxed setups where managing a
     * shared secret is friction; production callers should set it.
     */
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

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;
}
