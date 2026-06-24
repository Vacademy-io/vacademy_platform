package vacademy.io.admin_core_service.features.telephony.spi.dto;

import lombok.Builder;
import lombok.Value;

import java.util.Map;

/**
 * Decrypted credentials handed to a provider adapter. Lifetime is one request —
 * never persisted, never logged.
 *
 * <p>Two shapes coexist, deliberately:
 * <ul>
 *   <li>The legacy HTTP-Basic triplet ({@code accountId}/{@code username}/
 *       {@code password}) the Exotel adapter reads directly. Kept so the
 *       working Exotel path is untouched.</li>
 *   <li>A generic, provider-declared {@code secrets} map (decrypted from
 *       {@code provider_secrets_enc}) plus a non-secret {@code config} map
 *       (from {@code provider_config}). A new provider's adapter reads
 *       {@code secrets.get("consumerKey")}, {@code config.get("accountId")},
 *       etc. — no Vonage/Airtel-specific fields on this shared DTO.</li>
 * </ul>
 * {@code authType} (BASIC | OAUTH2_PASSWORD | …) tells the token broker how to
 * authenticate.
 */
@Value
@Builder
public class ProviderCredentials {
    String providerType;
    String authType;      // BASIC (Exotel) | OAUTH2_PASSWORD (Vonage/Airtel) | …
    String accountId;     // legacy convenience (e.g. Exotel Account SID)
    String username;      // legacy HTTP Basic Auth username
    String password;      // legacy HTTP Basic Auth password

    /** Provider-declared secret fields (decrypted). Empty for legacy rows. */
    @Builder.Default
    Map<String, String> secrets = Map.of();
    /** Provider-declared non-secret config fields. Empty for legacy rows. */
    @Builder.Default
    Map<String, String> config = Map.of();

    /** Null-safe secret lookup. */
    public String secret(String key) {
        return secrets == null ? null : secrets.get(key);
    }

    /** Null-safe config lookup. */
    public String conf(String key) {
        return config == null ? null : config.get(key);
    }
}
