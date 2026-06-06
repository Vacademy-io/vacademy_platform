package vacademy.io.admin_core_service.features.telephony.spi.dto;

import lombok.Builder;
import lombok.Value;

/**
 * Secrets used to verify an inbound webhook. Separate from ProviderCredentials
 * (Interface Segregation): a provider that needs an HMAC shared secret has it
 * here; one that uses IP allowlist alone simply ignores it.
 */
@Value
@Builder
public class ProviderSecrets {
    /** Shared secret carried as ?token= on the StatusCallback URL. */
    String webhookToken;
    /** Optional HMAC key if the provider signs the body. */
    String hmacKey;
}
