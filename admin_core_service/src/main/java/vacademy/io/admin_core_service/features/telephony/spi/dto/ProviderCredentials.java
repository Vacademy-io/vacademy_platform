package vacademy.io.admin_core_service.features.telephony.spi.dto;

import lombok.Builder;
import lombok.Value;

/**
 * Decrypted credentials handed to a provider adapter. Lifetime is one request —
 * never persisted, never logged.
 */
@Value
@Builder
public class ProviderCredentials {
    String providerType;
    String accountId;     // e.g. Exotel Account SID
    String username;      // HTTP Basic Auth username
    String password;      // HTTP Basic Auth password
}
