package vacademy.io.admin_core_service.features.telephony.spi.dto;

import lombok.Builder;
import lombok.Value;

import java.util.Map;

/**
 * Secrets used to verify an inbound webhook. Separate from ProviderCredentials
 * (Interface Segregation): a provider that needs an HMAC shared secret has it
 * here; one that uses IP allowlist alone simply ignores it.
 */
@Value
@Builder
public class ProviderSecrets {
    /** Shared secret carried as ?token= on the StatusCallback URL (Exotel). */
    String webhookToken;
    /** Optional HMAC key if the provider signs the body. */
    String hmacKey;
    /**
     * The provider's full decrypted secret bag (from provider_secrets_enc), so a
     * signed-webhook provider (Airtel/Vonage VIS) can read its signing key —
     * {@code secret("signingKey")} — and HMAC/JWT-verify over the raw body.
     * Empty for legacy Exotel rows, which verify via {@link #webhookToken}.
     */
    @Builder.Default
    Map<String, String> secrets = Map.of();

    /** Null-safe lookup into the generic secret bag. */
    public String secret(String key) {
        return secrets == null ? null : secrets.get(key);
    }
}
